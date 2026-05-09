import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  BattleAnswerStatus,
  BattleFormat,
  BattlePlayerResult,
  BattleRole,
  BattleRoomStatus,
  BattleSkill,
  BattleStatus,
  Prisma,
  QuestionSkill,
  QuestionStatus,
  QuestionType,
  RoomTeam,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoomService } from '../room/room.service';
import {
  CreateBattleFromRoomDto,
  SubmitAnswerDto,
} from './dto';
import { toBattleResponse } from './battle.mapper';

@Injectable()
export class BattleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomService: RoomService,
  ) { }

  async createFromRoom(userId: string, roomId: string, dto: CreateBattleFromRoomDto) {
    const questionCount = dto.questionCount ?? 10;

    const room = await this.prisma.battleRoom.findUnique({
      where: { id: roomId },
      include: {
        members: true,
        battle: true,
      },
    });

    if (!room) {
      throw new BadRequestException('Room not found');
    }

    if (room.hostUserId !== userId) {
      throw new ForbiddenException('Only host can create battle from room');
    }

    if (room.status !== BattleRoomStatus.READY) {
      throw new BadRequestException('Room is not ready');
    }

    if (room.battle) {
      const existingBattle = await this.getBattleOrThrow(room.battle.id);
      return toBattleResponse(existingBattle);
    }

    const activeMembers = room.members.filter((member) => !member.leftAt);

    this.assertRoomComposition(room.format, activeMembers);

    const questionPlan = await this.buildQuestionPlan(
      room.format,
      room.skill,
      questionCount,
    );

    const battle = await this.prisma.$transaction(async (tx) => {
      const createdBattle = await tx.battleSession.create({
        data: {
          roomId: room.id,
          format: room.format,
          skill: room.skill,
          isRanked: room.isRanked,
          status: BattleStatus.CREATED,
          questionCount,
          createdBy: userId,
        },
      });

      await tx.battlePlayer.createMany({
        data: activeMembers.map((member) => ({
          battleId: createdBattle.id,
          userId: member.userId,
          team: member.team,
          role: member.role,
        })),
      });

      await tx.battleQuestionSnapshot.createMany({
        data: questionPlan.map((item) => ({
          battleId: createdBattle.id,
          sourceQuestionId: item.question.id,
          sourceQuestionVersion: item.question.version,
          questionIndex: item.questionIndex,
          skill: item.question.skill,
          difficulty: item.question.difficulty,
          type: item.question.type,
          promptText: item.question.promptText,
          explanation: item.question.explanation,
          mediaJson: item.question.media.map((media) => ({
            type: media.type,
            url: media.url,
            durationSec: media.durationSec,
            mimeType: media.mimeType,
            orderIndex: media.orderIndex,
          })) as Prisma.InputJsonValue,
          optionsJson: item.question.options.map((option) => ({
            key: option.key,
            text: option.text,
            mediaUrl: option.mediaUrl,
            orderIndex: option.orderIndex,
          })) as Prisma.InputJsonValue,
          correctOptionKey: item.question.correctOptionKey,
          acceptedAnswers: item.question.acceptedAnswers,
          maxTimeSec: item.question.maxTimeSec,
          baseScore: item.question.baseScore,
          speedBonus: item.question.speedBonus,
          assignedRole: item.assignedRole,
        })),
      });

      await tx.battleRoom.update({
        where: { id: room.id },
        data: {
          status: BattleRoomStatus.PLAYING,
          startedAt: new Date(),
        },
      });

      return tx.battleSession.findUniqueOrThrow({
        where: { id: createdBattle.id },
        include: {
          players: true,
          questions: true,
        },
      });
    });

    return toBattleResponse(battle);
  }

  async getBattle(battleId: string) {
    const battle = await this.getBattleOrThrow(battleId);
    return toBattleResponse(battle);
  }

  async startBattle(userId: string, battleId: string) {
    const battle = await this.getBattleOrThrow(battleId);

    if (battle.createdBy !== userId) {
      throw new ForbiddenException('Only battle creator can start battle');
    }

    if (battle.status !== BattleStatus.CREATED) {
      throw new BadRequestException('Battle cannot be started');
    }

    const updated = await this.prisma.battleSession.update({
      where: { id: battleId },
      data: {
        status: BattleStatus.RUNNING,
        startedAt: new Date(),
      },
      include: {
        players: true,
        questions: true,
        submissions: true,
      },
    });

    return toBattleResponse(updated);
  }

  async getPublicQuestions(userId: string, battleId: string) {
    const battle = await this.getBattleOrThrow(battleId);

    this.assertPlayerInBattle(userId, battle.players);

    if (battle.status !== BattleStatus.RUNNING) {
      throw new BadRequestException('Battle is not running');
    }

    const player = battle.players.find((item) => item.userId === userId)!;

    const questions = battle.questions
      .filter((question) => {
        if (battle.format === BattleFormat.DUEL_1V1) {
          return question.assignedRole === null;
        }

        return question.assignedRole === player.role;
      })
      .sort((a, b) => a.questionIndex - b.questionIndex)
      .map((question) => ({
        id: question.id,
        questionIndex: question.questionIndex,
        skill: question.skill,
        difficulty: question.difficulty,
        type: question.type,
        assignedRole: question.assignedRole,
        promptText: question.promptText,
        media: question.mediaJson,
        options: question.optionsJson,
        maxTimeSec: question.maxTimeSec,
        baseScore: question.baseScore,
        speedBonus: question.speedBonus,
      }));

    return {
      battleId: battle.id,
      status: battle.status,
      format: battle.format,
      player: {
        userId: player.userId,
        team: player.team,
        role: player.role,
      },
      questions,
    };
  }

  async submitAnswer(userId: string, battleId: string, dto: SubmitAnswerDto) {
    const battle = await this.getBattleOrThrow(battleId);

    this.assertPlayerInBattle(userId, battle.players);

    if (battle.status !== BattleStatus.RUNNING) {
      throw new BadRequestException('Battle is not running');
    }

    const player = battle.players.find((item) => item.userId === userId)!;

    const question = battle.questions.find(
      (item) => item.id === dto.questionSnapshotId,
    );

    if (!question) {
      throw new BadRequestException('Question does not belong to this battle');
    }

    if (battle.format === BattleFormat.TEAM_3V3) {
      if (question.assignedRole !== player.role) {
        throw new ForbiddenException('This question is not assigned to your role');
      }
    }

    const alreadySubmitted = battle.submissions.some(
      (submission) =>
        submission.userId === userId &&
        submission.questionSnapshotId === dto.questionSnapshotId,
    );

    if (alreadySubmitted) {
      throw new BadRequestException('Answer already submitted');
    }

    const answerResult = this.evaluateAnswer(question, dto);
    const score = answerResult.isCorrect
      ? this.calculateScore(
        question.baseScore,
        question.speedBonus,
        question.maxTimeSec,
        dto.responseTimeMs,
      )
      : 0;

    const updatedBattle = await this.prisma.$transaction(async (tx) => {
      await tx.battleAnswerSubmission.create({
        data: {
          battleId,
          questionSnapshotId: question.id,
          userId,
          selectedOptionKey: dto.selectedOptionKey?.trim().toUpperCase(),
          textAnswer: dto.textAnswer?.trim(),
          responseTimeMs: dto.responseTimeMs,
          status: answerResult.status,
          isCorrect: answerResult.isCorrect,
          score,
        },
      });

      await tx.battlePlayer.update({
        where: {
          battleId_userId: {
            battleId,
            userId,
          },
        },
        data: {
          score: {
            increment: score,
          },
          correctCount: {
            increment: answerResult.isCorrect ? 1 : 0,
          },
          totalResponseTimeMs: {
            increment: answerResult.isCorrect ? dto.responseTimeMs : 0,
          },
        },
      });

      return tx.battleSession.findUniqueOrThrow({
        where: { id: battleId },
        include: {
          players: true,
          questions: true,
          submissions: true,
        },
      });
    });

    return {
      submission: {
        questionSnapshotId: question.id,
        isCorrect: answerResult.isCorrect,
        status: answerResult.status,
        score,
      },
      battle: toBattleResponse(updatedBattle),
    };
  }

  async finishBattle(userId: string, battleId: string) {
    const battle = await this.getBattleOrThrow(battleId);

    if (battle.createdBy !== userId) {
      throw new ForbiddenException('Only battle creator can finish battle');
    }

    if (battle.status !== BattleStatus.RUNNING) {
      throw new BadRequestException('Battle is not running');
    }

    const resultUpdates = this.calculateBattleResults(battle);

    const updatedBattle = await this.prisma.$transaction(async (tx) => {
      for (const update of resultUpdates) {
        await tx.battlePlayer.update({
          where: {
            battleId_userId: {
              battleId,
              userId: update.userId,
            },
          },
          data: {
            result: update.result,
          },
        });
      }

      await tx.battleSession.update({
        where: { id: battleId },
        data: {
          status: BattleStatus.FINISHED,
          finishedAt: new Date(),
        },
      });

      await tx.battleRoom.update({
        where: { id: battle.roomId },
        data: {
          status: BattleRoomStatus.FINISHED,
          closedAt: new Date(),
          closeReason: 'BATTLE_FINISHED',
        },
      });

      return tx.battleSession.findUniqueOrThrow({
        where: { id: battleId },
        include: {
          players: true,
          questions: true,
          submissions: true,
        },
      });
    });

    return toBattleResponse(updatedBattle);
  }

  async getResult(battleId: string) {
    const battle = await this.getBattleOrThrow(battleId);

    if (battle.status !== BattleStatus.FINISHED) {
      throw new BadRequestException('Battle is not finished');
    }

    return toBattleResponse(battle);
  }

  async adminGetBattleDetail(battleId: string) {
    const battle = await this.prisma.battleSession.findUniqueOrThrow({
      where: { id: battleId },
      include: {
        players: true,
        questions: true,
        submissions: true,
        room: {
          include: {
            members: true,
          },
        },
      },
    });

    return {
      id: battle.id,
      roomId: battle.roomId,
      format: battle.format,
      skill: battle.skill,
      isRanked: battle.isRanked,
      status: battle.status,
      questionCount: battle.questionCount,
      createdBy: battle.createdBy,
      createdAt: battle.createdAt,
      startedAt: battle.startedAt,
      finishedAt: battle.finishedAt,

      room: {
        id: battle.room.id,
        code: battle.room.code,
        status: battle.room.status,
        hostUserId: battle.room.hostUserId,
        members: battle.room.members
          .filter((member) => !member.leftAt)
          .map((member) => ({
            userId: member.userId,
            team: member.team,
            role: member.role,
            isReady: member.isReady,
          })),
      },

      players: battle.players.map((player) => ({
        userId: player.userId,
        team: player.team,
        role: player.role,
        score: player.score,
        correctCount: player.correctCount,
        totalResponseTimeMs: player.totalResponseTimeMs,
        result: player.result,
      })),

      questions: battle.questions
        .sort((a, b) => {
          if ((a.assignedRole ?? '') === (b.assignedRole ?? '')) {
            return a.questionIndex - b.questionIndex;
          }

          return String(a.assignedRole ?? '').localeCompare(
            String(b.assignedRole ?? ''),
          );
        })
        .map((question) => ({
          id: question.id,
          questionIndex: question.questionIndex,
          sourceQuestionId: question.sourceQuestionId,
          sourceQuestionVersion: question.sourceQuestionVersion,
          skill: question.skill,
          difficulty: question.difficulty,
          type: question.type,
          assignedRole: question.assignedRole,
          promptText: question.promptText,
          media: question.mediaJson,
          options: question.optionsJson,

          correctOptionKey: question.correctOptionKey,
          acceptedAnswers: question.acceptedAnswers,
          explanation: question.explanation,

          maxTimeSec: question.maxTimeSec,
          baseScore: question.baseScore,
          speedBonus: question.speedBonus,
        })),

      submissions: battle.submissions.map((submission) => ({
        id: submission.id,
        questionSnapshotId: submission.questionSnapshotId,
        userId: submission.userId,
        selectedOptionKey: submission.selectedOptionKey,
        textAnswer: submission.textAnswer,
        responseTimeMs: submission.responseTimeMs,
        status: submission.status,
        isCorrect: submission.isCorrect,
        score: submission.score,
        submittedAt: submission.submittedAt,
      })),
    };
  }

  private async getBattleOrThrow(battleId: string) {
    return this.prisma.battleSession.findUniqueOrThrow({
      where: { id: battleId },
      include: {
        players: true,
        questions: true,
        submissions: true,
      },
    });
  }

  private assertRoomComposition(
    format: BattleFormat,
    members: Array<{ team: RoomTeam; role: BattleRole | null }>,
  ) {
    if (format === BattleFormat.DUEL_1V1) {
      if (members.length !== 2) {
        throw new BadRequestException('DUEL_1V1 requires exactly 2 players');
      }

      const hasA = members.some((member) => member.team === RoomTeam.A);
      const hasB = members.some((member) => member.team === RoomTeam.B);

      if (!hasA || !hasB) {
        throw new BadRequestException('DUEL_1V1 requires team A and team B');
      }

      return;
    }

    if (format === BattleFormat.TEAM_3V3) {
      if (members.length !== 6) {
        throw new BadRequestException('TEAM_3V3 requires exactly 6 players');
      }

      const requiredRoles = [
        BattleRole.GRAMMAR,
        BattleRole.LISTENING,
        BattleRole.VOCABULARY,
      ];

      for (const team of [RoomTeam.A, RoomTeam.B]) {
        const teamMembers = members.filter((member) => member.team === team);

        if (teamMembers.length !== 3) {
          throw new BadRequestException(`Team ${team} must have 3 players`);
        }

        for (const role of requiredRoles) {
          const count = teamMembers.filter((member) => member.role === role).length;

          if (count !== 1) {
            throw new BadRequestException(
              `Team ${team} must have exactly one ${role}`,
            );
          }
        }
      }
    }
  }

  private async buildQuestionPlan(
    format: BattleFormat,
    roomSkill: BattleSkill,
    questionCount: number,
  ) {
    if (format === BattleFormat.DUEL_1V1) {
      const skillFilter =
        roomSkill === BattleSkill.MIXED
          ? undefined
          : this.mapBattleSkillToQuestionSkill(roomSkill);

      const questions = await this.prisma.battleQuestion.findMany({
        where: {
          status: QuestionStatus.APPROVED,
          skill: skillFilter,
        },
        include: {
          options: true,
          media: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: questionCount,
      });

      if (questions.length < questionCount) {
        throw new BadRequestException(
          `Not enough approved questions for ${roomSkill}. Required ${questionCount}, found ${questions.length}`,
        );
      }

      return questions.map((question, index) => ({
        question,
        questionIndex: index + 1,
        assignedRole: null,
      }));
    }

    const roles = [
      BattleRole.GRAMMAR,
      BattleRole.LISTENING,
      BattleRole.VOCABULARY,
    ];

    const plan: Array<{
      question: any;
      questionIndex: number;
      assignedRole: BattleRole;
    }> = [];

    for (const role of roles) {
      const skill = this.mapRoleToQuestionSkill(role);

      const questions = await this.prisma.battleQuestion.findMany({
        where: {
          status: QuestionStatus.APPROVED,
          skill,
        },
        include: {
          options: true,
          media: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: questionCount,
      });

      if (questions.length < questionCount) {
        throw new BadRequestException(
          `Not enough approved questions for role ${role}. Required ${questionCount}, found ${questions.length}`,
        );
      }

      questions.forEach((question, index) => {
        plan.push({
          question,
          questionIndex: index + 1,
          assignedRole: role,
        });
      });
    }

    return plan;
  }

  private mapBattleSkillToQuestionSkill(skill: BattleSkill): QuestionSkill {
    if (skill === BattleSkill.GRAMMAR) return QuestionSkill.GRAMMAR;
    if (skill === BattleSkill.LISTENING) return QuestionSkill.LISTENING;
    if (skill === BattleSkill.VOCABULARY) return QuestionSkill.VOCABULARY;

    throw new BadRequestException('MIXED does not map to single question skill');
  }

  private mapRoleToQuestionSkill(role: BattleRole): QuestionSkill {
    if (role === BattleRole.GRAMMAR) return QuestionSkill.GRAMMAR;
    if (role === BattleRole.LISTENING) return QuestionSkill.LISTENING;
    return QuestionSkill.VOCABULARY;
  }
  private evaluateAnswer(
    question: {
      type: QuestionType;
      correctOptionKey: string | null;
      acceptedAnswers: string[];
      maxTimeSec: number;
    },
    dto: SubmitAnswerDto,
  ) {
    if (dto.responseTimeMs > question.maxTimeSec * 1000) {
      return {
        isCorrect: false,
        status: BattleAnswerStatus.TIMEOUT,
      };
    }

    if (question.type === QuestionType.MULTIPLE_CHOICE) {
      const selected = dto.selectedOptionKey?.trim().toUpperCase();

      if (!selected) {
        throw new BadRequestException('selectedOptionKey is required for MCQ');
      }

      const correct = question.correctOptionKey?.trim().toUpperCase();

      return {
        isCorrect: selected === correct,
        status:
          selected === correct
            ? BattleAnswerStatus.CORRECT
            : BattleAnswerStatus.WRONG,
      };
    }

    if (question.type === QuestionType.FILL_BLANK) {
      const answer = dto.textAnswer?.trim();

      if (!answer) {
        throw new BadRequestException('textAnswer is required for FILL_BLANK');
      }

      const normalizedAnswer = this.normalizeTextAnswer(answer);

      const accepted = question.acceptedAnswers.map((item) =>
        this.normalizeTextAnswer(item),
      );

      const isCorrect = accepted.includes(normalizedAnswer);

      return {
        isCorrect,
        status: isCorrect ? BattleAnswerStatus.CORRECT : BattleAnswerStatus.WRONG,
      };
    }

    throw new BadRequestException('Unsupported question type');
  }

  private calculateScore(
    baseScore: number,
    speedBonus: number,
    maxTimeSec: number,
    responseTimeMs: number,
  ) {
    const responseTimeSec = responseTimeMs / 1000;
    const ratio = 1 - responseTimeSec / maxTimeSec;
    const safeRatio = Math.max(0, Math.min(1, ratio));

    return Math.round(baseScore + speedBonus * safeRatio);
  }

  private normalizeTextAnswer(value: string) {
    return value.trim().toLowerCase();
  }

  private assertPlayerInBattle(
    userId: string,
    players: Array<{ userId: string }>,
  ) {
    if (!players.some((player) => player.userId === userId)) {
      throw new ForbiddenException('You are not in this battle');
    }
  }
  private calculateBattleResults(battle: {
    format: BattleFormat;
    players: Array<{
      userId: string;
      team: RoomTeam;
      score: number;
      correctCount: number;
      totalResponseTimeMs: number;
    }>;
  }) {
    if (battle.format === BattleFormat.DUEL_1V1) {
      return this.calculateDuelResult(battle.players);
    }

    return this.calculateTeam3v3Result(battle.players);
  }

  private calculateDuelResult(
    players: Array<{
      userId: string;
      score: number;
      correctCount: number;
      totalResponseTimeMs: number;
    }>,
  ) {
    if (players.length !== 2) {
      throw new BadRequestException('DUEL_1V1 result requires exactly 2 players');
    }

    const [p1, p2] = players;

    const winner = this.comparePlayers(p1, p2);

    if (winner === 1) {
      return [
        { userId: p1.userId, result: BattlePlayerResult.WIN },
        { userId: p2.userId, result: BattlePlayerResult.LOSE },
      ];
    }

    if (winner === 2) {
      return [
        { userId: p1.userId, result: BattlePlayerResult.LOSE },
        { userId: p2.userId, result: BattlePlayerResult.WIN },
      ];
    }

    return [
      { userId: p1.userId, result: BattlePlayerResult.DRAW },
      { userId: p2.userId, result: BattlePlayerResult.DRAW },
    ];
  }

  private calculateTeam3v3Result(
    players: Array<{
      userId: string;
      team: RoomTeam;
      score: number;
      correctCount: number;
      totalResponseTimeMs: number;
    }>,
  ) {
    const teamA = players.filter((player) => player.team === RoomTeam.A);
    const teamB = players.filter((player) => player.team === RoomTeam.B);

    const summaryA = this.summarizeTeam(teamA);
    const summaryB = this.summarizeTeam(teamB);

    const winner = this.compareTeamSummaries(summaryA, summaryB);

    if (winner === 1) {
      return players.map((player) => ({
        userId: player.userId,
        result:
          player.team === RoomTeam.A
            ? BattlePlayerResult.WIN
            : BattlePlayerResult.LOSE,
      }));
    }

    if (winner === 2) {
      return players.map((player) => ({
        userId: player.userId,
        result:
          player.team === RoomTeam.B
            ? BattlePlayerResult.WIN
            : BattlePlayerResult.LOSE,
      }));
    }

    return players.map((player) => ({
      userId: player.userId,
      result: BattlePlayerResult.DRAW,
    }));
  }

  private comparePlayers(
    p1: {
      score: number;
      correctCount: number;
      totalResponseTimeMs: number;
    },
    p2: {
      score: number;
      correctCount: number;
      totalResponseTimeMs: number;
    },
  ) {
    if (p1.score > p2.score) return 1;
    if (p2.score > p1.score) return 2;

    if (p1.correctCount > p2.correctCount) return 1;
    if (p2.correctCount > p1.correctCount) return 2;

    if (p1.totalResponseTimeMs < p2.totalResponseTimeMs) return 1;
    if (p2.totalResponseTimeMs < p1.totalResponseTimeMs) return 2;

    return 0;
  }

  private summarizeTeam(
    players: Array<{
      score: number;
      correctCount: number;
      totalResponseTimeMs: number;
    }>,
  ) {
    return {
      score: players.reduce((sum, player) => sum + player.score, 0),
      correctCount: players.reduce(
        (sum, player) => sum + player.correctCount,
        0,
      ),
      totalResponseTimeMs: players.reduce(
        (sum, player) => sum + player.totalResponseTimeMs,
        0,
      ),
    };
  }

  private compareTeamSummaries(
    a: {
      score: number;
      correctCount: number;
      totalResponseTimeMs: number;
    },
    b: {
      score: number;
      correctCount: number;
      totalResponseTimeMs: number;
    },
  ) {
    if (a.score > b.score) return 1;
    if (b.score > a.score) return 2;

    if (a.correctCount > b.correctCount) return 1;
    if (b.correctCount > a.correctCount) return 2;

    if (a.totalResponseTimeMs < b.totalResponseTimeMs) return 1;
    if (b.totalResponseTimeMs < a.totalResponseTimeMs) return 2;

    return 0;
  }
}