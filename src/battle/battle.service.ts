import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BattleStatus, BattleType, Level, Mode, Role, RoomStatus, WinnerSide } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { acquireLock, releaseLock } from '../redis/lock';
import { BattleGateway } from '../ws/battle.gateway';
import { QuestionBankService } from './question-bank.service';
import { RankService } from './rank.service';

function cfgQuestionCount(mode: Mode) {
  return mode === Mode.THREE_VS_THREE ? 12 : 10;
}
function cfgTimeLimitSec(mode: Mode) {
  return mode === Mode.THREE_VS_THREE ? 180 : 120;
}

@Injectable()
export class BattleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly ws: BattleGateway,
    private readonly qb: QuestionBankService,
    private readonly rank: RankService,
  ) {}

  async createBattleFromRoom(roomId: string, userId: string) {
    const lockKey = `lock:battle:from-room:${roomId}`;
    const token = await acquireLock(this.redis.client, lockKey, 5000);
    if (!token) throw new ConflictException('LOCKED_TRY_AGAIN');

    try {
      const room = await this.prisma.battleRoom.findUnique({
        where: { id: roomId },
        include: { members: { where: { leftAt: null } } },
      });
      if (!room) throw new NotFoundException('ROOM_NOT_FOUND');
      if (room.hostUserId !== userId) throw new ForbiddenException('NOT_HOST');
      if (room.status !== RoomStatus.PLAYING) throw new BadRequestException('ROOM_NOT_PLAYING');

      // if battle already exists
      const existing = await this.prisma.battle.findUnique({ where: { roomId } });
      if (existing) return { battleId: existing.id, status: existing.status.toLowerCase() };

      const questionCount = cfgQuestionCount(room.mode);
      const timeLimitSec = cfgTimeLimitSec(room.mode);

      const battle = await this.prisma.battle.create({
        data: {
          roomId,
          mode: room.mode,
          battleType: room.battleType,
          level: room.level,
          status: BattleStatus.CREATED,
          questionCount,
          timeLimitSec,
          participants: {
            create: room.members.map(m => ({
              userId: m.userId,
              team: m.team,
              role: m.role,
            })),
          },
        },
      });

      this.ws.emitBattleCreated(battle.id, { battleId: battle.id, roomId });
      return { battleId: battle.id, status: 'created' };
    } finally {
      await releaseLock(this.redis.client, lockKey, token);
    }
  }

  async startBattle(battleId: string, userId: string) {
    const lockKey = `lock:battle:start:${battleId}`;
    const token = await acquireLock(this.redis.client, lockKey, 8000);
    if (!token) throw new ConflictException('LOCKED_TRY_AGAIN');

    try {
      await this.qb.seedIfEmpty();

      const battle = await this.prisma.battle.findUnique({
        where: { id: battleId },
        include: { participants: true },
      });
      if (!battle) throw new NotFoundException('BATTLE_NOT_FOUND');
      if (battle.status !== BattleStatus.CREATED) throw new BadRequestException('BATTLE_NOT_CREATED');

      // host check from room (optional)
      if (battle.roomId) {
        const room = await this.prisma.battleRoom.findUnique({ where: { id: battle.roomId } });
        if (room && room.hostUserId !== userId) throw new ForbiddenException('NOT_HOST');
      }

      // build question set (mixed => distribute roles)
      const qs = await this.buildQuestionInstances(battle);

      await this.prisma.$transaction(async tx => {
        await tx.battleQuestionInstance.createMany({ data: qs });
        await tx.battle.update({
          where: { id: battleId },
          data: { status: BattleStatus.STARTED, startedAt: new Date() },
        });
      });

      const started = await this.prisma.battle.findUnique({ where: { id: battleId } });
      this.ws.emitBattleStarted(battleId, {
        battleId,
        status: 'started',
        startedAt: started!.startedAt!.toISOString(),
        timeLimitSec: started!.timeLimitSec,
        questionCount: started!.questionCount,
      });

      // push initial state
      const state = await this.getBattleState(battleId, battle.participants[0]?.userId ?? userId);
      this.ws.emitBattleState(battleId, state);

      return {
        battleId,
        status: 'started',
        startedAt: started!.startedAt!.toISOString(),
        timeLimitSec: started!.timeLimitSec,
        questionCount: started!.questionCount,
      };
    } finally {
      await releaseLock(this.redis.client, lockKey, token);
    }
  }

  private async buildQuestionInstances(battle: any) {
    const count = battle.questionCount;
    const level: Level = battle.level;

    const types: BattleType[] =
      battle.battleType === BattleType.MIXED
        ? [BattleType.LISTENING, BattleType.READING, BattleType.WRITING]
        : [battle.battleType];

    // mixed: round-robin types
    const picked: any[] = [];
    for (let i = 0; i < count; i++) {
      const t = types[i % types.length];
      const item = (await this.qb.pickRandom(t, level, 1))[0];
      if (!item) throw new BadRequestException('QUESTION_BANK_EMPTY');
      picked.push(item);
    }

    return picked.map((q, idx) => ({
      battleId: battle.id,
      order: idx + 1,
      bankType: q.bankType,
      level: q.level,
      questionId: q.id,
      prompt: q.prompt,
      options: q.options,
      correctKey: q.correctKey,
    }));
  }

  async getBattleState(battleId: string, userId: string) {
    const battle = await this.prisma.battle.findUnique({
      where: { id: battleId },
      include: {
        participants: true,
        questions: { orderBy: { order: 'asc' } },
      },
    });
    if (!battle) throw new NotFoundException('BATTLE_NOT_FOUND');

    const now = Date.now();
    const startedAt = battle.startedAt?.getTime() ?? now;
    const elapsedSec = battle.status === BattleStatus.STARTED ? Math.floor((now - startedAt) / 1000) : 0;
    const timeLeftSec = battle.status === BattleStatus.STARTED ? Math.max(0, battle.timeLimitSec - elapsedSec) : battle.timeLimitSec;

    // determine current question for user: first unanswered
    let current: any = null;
    if (battle.status === BattleStatus.STARTED) {
      const answers = await this.prisma.battleAnswer.findMany({
        where: { battleId, userId },
        select: { questionInstId: true },
      });
      const answered = new Set(answers.map(a => a.questionInstId));
      const q = battle.questions.find(qi => !answered.has(qi.id));
      if (q) {
        current = {
          order: q.order,
          questionInstId: q.id,
          prompt: q.prompt,
          options: q.options,
          bankType: q.bankType.toLowerCase(),
          level: q.level.toLowerCase(),
        };
      }
    }

    return {
      battleId: battle.id,
      status: battle.status.toLowerCase(),
      mode: battle.mode === Mode.ONE_VS_ONE ? '1v1' : '3v3',
      battleType: battle.battleType.toLowerCase(),
      level: battle.level.toLowerCase(),
      timeLimitSec: battle.timeLimitSec,
      timeLeftSec,
      scoreA: battle.scoreA,
      scoreB: battle.scoreB,
      participants: battle.participants.map(p => ({
        userId: p.userId,
        team: p.team,
        role: p.role ? p.role.toLowerCase() : null,
        correctCount: p.correctCount,
        wrongCount: p.wrongCount,
        totalTimeMs: p.totalTimeMs,
        score: p.score,
      })),
      current,
    };
  }

  async finishBattle(battleId: string, reason: string) {
    const lockKey = `lock:battle:finish:${battleId}`;
    const token = await acquireLock(this.redis.client, lockKey, 8000);
    if (!token) throw new ConflictException('LOCKED_TRY_AGAIN');

    try {
      const battle = await this.prisma.battle.findUnique({
        where: { id: battleId },
        include: { participants: true },
      });
      if (!battle) throw new NotFoundException('BATTLE_NOT_FOUND');
      if (battle.status !== BattleStatus.STARTED) {
        // idempotent
        return { battleId, status: battle.status.toLowerCase() };
      }

      // compute winner
      let winnerSide: WinnerSide = WinnerSide.DRAW;
      if (battle.scoreA > battle.scoreB) winnerSide = WinnerSide.A;
      else if (battle.scoreB > battle.scoreA) winnerSide = WinnerSide.B;

      await this.prisma.battle.update({
        where: { id: battleId },
        data: {
          status: BattleStatus.FINISHED,
          finishedAt: new Date(),
          winnerSide,
          winReason: reason,
        },
      });

      // Rank update (Sprint 3)
      await this.rank.applyBattleRank(battleId);

      const result = await this.getBattleResult(battleId);
      this.ws.emitBattleFinished(battleId, result);

      return result;
    } finally {
      await releaseLock(this.redis.client, lockKey, token);
    }
  }

  async getBattleResult(battleId: string) {
    const battle = await this.prisma.battle.findUnique({
      where: { id: battleId },
      include: { participants: true },
    });
    if (!battle) throw new NotFoundException('BATTLE_NOT_FOUND');

    return {
      battleId: battle.id,
      status: battle.status.toLowerCase(),
      winnerSide: battle.winnerSide?.toLowerCase() ?? null,
      winReason: battle.winReason ?? null,
      scoreA: battle.scoreA,
      scoreB: battle.scoreB,
      participants: battle.participants.map(p => ({
        userId: p.userId,
        team: p.team,
        role: p.role ? p.role.toLowerCase() : null,
        correctCount: p.correctCount,
        wrongCount: p.wrongCount,
        totalTimeMs: p.totalTimeMs,
        score: p.score,
      })),
    };
  }

  async getBattleHistory(userId: string) {
    const battles = await this.prisma.battleParticipant.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { battleId: true },
    });
    const ids = [...new Set(battles.map(b => b.battleId))];

    const rows = await this.prisma.battle.findMany({
      where: { id: { in: ids } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      items: rows.map(b => ({
        battleId: b.id,
        status: b.status.toLowerCase(),
        mode: b.mode === Mode.ONE_VS_ONE ? '1v1' : '3v3',
        battleType: b.battleType.toLowerCase(),
        level: b.level.toLowerCase(),
        createdAt: b.createdAt.toISOString(),
        startedAt: b.startedAt?.toISOString() ?? null,
        finishedAt: b.finishedAt?.toISOString() ?? null,
        winnerSide: b.winnerSide?.toLowerCase() ?? null,
        scoreA: b.scoreA,
        scoreB: b.scoreB,
      })),
    };
  }

  async getBattleDetailForUser(battleId: string, userId: string) {
    const battle = await this.prisma.battle.findUnique({
      where: { id: battleId },
      include: {
        questions: { orderBy: { order: 'asc' } },
      },
    });
    if (!battle) throw new NotFoundException('BATTLE_NOT_FOUND');

    const answers = await this.prisma.battleAnswer.findMany({
      where: { battleId, userId },
      orderBy: { answeredAt: 'asc' },
    });

    // only return your own answers + question prompt/options, never correctKey
    const qmap = new Map(battle.questions.map(q => [q.id, q]));
    return {
      battleId,
      status: battle.status.toLowerCase(),
      items: answers.map(a => {
        const q = qmap.get(a.questionInstId);
        return {
          order: q?.order ?? null,
          questionInstId: a.questionInstId,
          prompt: q?.prompt ?? null,
          options: q?.options ?? null,
          selectedKey: a.selectedKey,
          isCorrect: a.isCorrect,
          timeMs: a.timeMs,
          answeredAt: a.answeredAt.toISOString(),
        };
      }),
    };
  }
}
