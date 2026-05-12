import { Injectable } from '@nestjs/common';
import {
  BattleFormat,
  BattlePlayerResult,
  RewardLedgerType,
} from '@prisma/client';
import { env } from '../common/env';
import { PrismaService } from '../prisma/prisma.service';
import {
  AFK_PENALTY,
  PARTICIPATION_REWARD,
  PARTICIPATION_THRESHOLD,
  resolvePerformanceReward,
  RESULT_REWARD,
} from './reward.constants';

@Injectable()
export class RewardService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateRewards(params: {
    userId: string;
    battleId: string;
    format: BattleFormat;
    result: BattlePlayerResult;
    score: number;
    answeredQuestions: number;
    assignedQuestions: number;
    opponentUserIds: string[];
  }) {
    const rewards: Array<{
      type: RewardLedgerType;
      amount: number;
      reason: string;
      metadata?: Record<string, unknown>;
    }> = [];

    const completionRatio =
      params.assignedQuestions === 0
        ? 0
        : params.answeredQuestions / params.assignedQuestions;

    if (completionRatio >= PARTICIPATION_THRESHOLD) {
      rewards.push({
        type: RewardLedgerType.PARTICIPATION,
        amount: PARTICIPATION_REWARD,
        reason: 'Participation reward',
      });
    } else {
      rewards.push({
        type: RewardLedgerType.PENALTY,
        amount: AFK_PENALTY,
        reason: 'AFK/incomplete battle penalty',
        metadata: { completionRatio },
      });
    }

    const resultType = this.mapResultToRewardType(params.result);

    rewards.push({
      type: resultType,
      amount: RESULT_REWARD[params.format][params.result],
      reason: `${params.result} reward`,
    });

    const performanceReward = resolvePerformanceReward(params.score);

    if (performanceReward > 0) {
      rewards.push({
        type: RewardLedgerType.PERFORMANCE,
        amount: performanceReward,
        reason: 'Performance reward',
      });
    }

    const reduced = await this.applyRepeatOpponentReduction(params, rewards);
    const capped = await this.applyDailyCap(params.userId, reduced);

    return capped;
  }

  async getMyWallet(userId: string) {
    const wallet = await this.prisma.playerRewardWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      return {
        userId,
        brainPointBalance: 0,
        totalEarned: 0,
        totalSpent: 0,
      };
    }

    return wallet;
  }

  async getMyLedger(userId: string, query: { page: number; limit: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.rewardLedger.count({ where: { userId } }),
      this.prisma.rewardLedger.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items,
    };
  }

  async adminGetWallet(userId: string) {
    return this.prisma.playerRewardWallet.findUnique({
      where: { userId },
    });
  }

  async adminGetLedger(userId: string, query: { page: number; limit: number }) {
    return this.getMyLedger(userId, query);
  }

  private mapResultToRewardType(result: BattlePlayerResult) {
    if (result === BattlePlayerResult.WIN) return RewardLedgerType.WIN;
    if (result === BattlePlayerResult.DRAW) return RewardLedgerType.DRAW;
    return RewardLedgerType.LOSE;
  }

  private async applyDailyCap(
    userId: string,
    rewards: Array<{
      type: RewardLedgerType;
      amount: number;
      reason: string;
      metadata?: Record<string, unknown>;
    }>,
  ) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const todayLedgers = await this.prisma.rewardLedger.findMany({
      where: {
        userId,
        createdAt: {
          gte: start,
        },
        amount: {
          gt: 0,
        },
      },
    });

    const todayEarned = todayLedgers.reduce(
      (sum, item) => sum + item.amount,
      0,
    );

    let remaining = Math.max(0, env.DAILY_BP_CAP - todayEarned);

    return rewards.map((reward) => {
      if (reward.amount <= 0) {
        return reward;
      }

      if (remaining <= 0) {
        return {
          ...reward,
          amount: 0,
          reason: `${reward.reason} capped by daily BP limit`,
          metadata: {
            ...reward.metadata,
            dailyCapApplied: true,
          },
        };
      }

      const amount = Math.min(reward.amount, remaining);
      remaining -= amount;

      return {
        ...reward,
        amount,
        metadata: {
          ...reward.metadata,
          dailyCapApplied: amount !== reward.amount,
        },
      };
    });
  }

  private async applyRepeatOpponentReduction(
    params: {
      userId: string;
      battleId: string;
      opponentUserIds: string[];
    },
    rewards: Array<{
      type: RewardLedgerType;
      amount: number;
      reason: string;
      metadata?: Record<string, unknown>;
    }>,
  ) {
    if (params.opponentUserIds.length === 0) {
      return rewards;
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const previousBattles = await this.prisma.battleSession.findMany({
      where: {
        id: {
          not: params.battleId,
        },
        finishedAt: {
          gte: start,
        },
        players: {
          some: {
            userId: params.userId,
          },
        },
      },
      include: {
        players: true,
      },
    });

    const repeatCount = previousBattles.filter((battle) =>
      battle.players.some((player) =>
        params.opponentUserIds.includes(player.userId),
      ),
    ).length;

    if (repeatCount < env.REPEAT_OPPONENT_LIMIT_PER_DAY) {
      return rewards;
    }

    return rewards.map((reward) => {
      if (reward.amount <= 0) {
        return reward;
      }

      return {
        ...reward,
        amount: Math.floor(
          reward.amount * env.REPEAT_OPPONENT_REWARD_MULTIPLIER,
        ),
        reason: `${reward.reason} reduced by repeat opponent policy`,
        metadata: {
          ...reward.metadata,
          repeatOpponentReduction: true,
          repeatCount,
        },
      };
    });
  }
}