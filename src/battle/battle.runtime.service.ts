import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BattleStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { acquireLock, releaseLock } from '../redis/lock';
import { BattleGateway } from '../ws/battle.gateway';
import { SubmitAnswerDto } from './dto';

function scoreForAnswer(isCorrect: boolean, timeMs: number) {
  if (!isCorrect) return 0;
  const base = 100;
  const bonus = Math.max(0, 50 - Math.floor(timeMs / 1000));
  return base + bonus;
}

@Injectable()
export class BattleRuntimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly ws: BattleGateway,
  ) {}

  async submitAnswer(battleId: string, dto: SubmitAnswerDto) {
    const lockKey = `lock:battle:submit:${battleId}:${dto.userId}`;
    const token = await acquireLock(this.redis.client, lockKey, 3000);
    if (!token) throw new ConflictException('LOCKED_TRY_AGAIN');

    try {
      const battle = await this.prisma.battle.findUnique({ where: { id: battleId } });
      if (!battle) throw new NotFoundException('BATTLE_NOT_FOUND');
      if (battle.status !== BattleStatus.STARTED) throw new BadRequestException('BATTLE_NOT_STARTED');

      const qi = await this.prisma.battleQuestionInstance.findUnique({ where: { id: dto.questionInstId } });
      if (!qi || qi.battleId !== battleId) throw new NotFoundException('QUESTION_NOT_FOUND');

      // check already answered (unique constraint too)
      const existing = await this.prisma.battleAnswer.findFirst({
        where: { questionInstId: dto.questionInstId, userId: dto.userId },
      });
      if (existing) return { ok: true, duplicated: true };

      const isCorrect = dto.selectedKey === qi.correctKey;
      const delta = scoreForAnswer(isCorrect, dto.timeMs);

      // find participant
      const participant = await this.prisma.battleParticipant.findUnique({
        where: { battleId_userId: { battleId, userId: dto.userId } } as any,
      });
      if (!participant) throw new BadRequestException('NOT_IN_BATTLE');

      await this.prisma.$transaction(async tx => {
        await tx.battleAnswer.create({
          data: {
            battleId,
            questionInstId: dto.questionInstId,
            userId: dto.userId,
            selectedKey: dto.selectedKey,
            isCorrect,
            timeMs: dto.timeMs,
          },
        });

        await tx.battleParticipant.update({
          where: { id: participant.id },
          data: {
            correctCount: participant.correctCount + (isCorrect ? 1 : 0),
            wrongCount: participant.wrongCount + (!isCorrect ? 1 : 0),
            totalTimeMs: participant.totalTimeMs + dto.timeMs,
            score: participant.score + delta,
          },
        });

        // update team score
        if (participant.team === 'A') {
          await tx.battle.update({ where: { id: battleId }, data: { scoreA: { increment: delta } } });
        } else {
          await tx.battle.update({ where: { id: battleId }, data: { scoreB: { increment: delta } } });
        }
      });

      // push state snapshot (cheap)
      const state = await this.prisma.battle.findUnique({ where: { id: battleId } });
      this.ws.emitBattleState(battleId, {
        battleId,
        scoreA: state?.scoreA ?? 0,
        scoreB: state?.scoreB ?? 0,
        last: { userId: dto.userId, questionInstId: dto.questionInstId },
      });

      // auto-finish if all answered
      await this.tryAutoFinish(battleId);

      return { ok: true, isCorrect, scoreDelta: delta };
    } finally {
      await releaseLock(this.redis.client, lockKey, token);
    }
  }

  private async tryAutoFinish(battleId: string) {
    const battle = await this.prisma.battle.findUnique({
      where: { id: battleId },
      include: { participants: true },
    });
    if (!battle || battle.status !== BattleStatus.STARTED) return;

    const qCount = await this.prisma.battleQuestionInstance.count({ where: { battleId } });
    const pCount = battle.participants.length;
    const ansCount = await this.prisma.battleAnswer.count({ where: { battleId } });

    // If each participant answered all questions => finish
    if (qCount > 0 && ansCount >= qCount * pCount) {
      // Let BattleSweeper or finish endpoint finalize; keep lightweight
      // You can call finish endpoint from here if you want,
      // but we keep it deterministic in sweeper.
      await this.redis.client.set(`battle:${battleId}:all_answered`, '1', 'PX', 60_000);
    }
  }
}
