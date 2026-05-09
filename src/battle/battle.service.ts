import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  BattleFormat,
  BattleRole,
  BattleRoomStatus,
  BattleSkill,
  BattleStatus,
  Prisma,
  QuestionSkill,
  QuestionStatus,
  RoomTeam,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoomService } from '../room/room.service';
import { CreateBattleFromRoomDto } from './dto';
import { toBattleResponse } from './battle.mapper';

@Injectable()
export class BattleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomService: RoomService,
  ) {}

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

  private async getBattleOrThrow(battleId: string) {
    return this.prisma.battleSession.findUniqueOrThrow({
      where: { id: battleId },
      include: {
        players: true,
        questions: true,
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
}