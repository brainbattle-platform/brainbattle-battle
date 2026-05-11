import { Injectable } from '@nestjs/common';
import {
  BattleFormat,
  BattlePlayerResult,
  RewardLedgerType,
} from '@prisma/client';
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

  calculateRewards(params: {
    format: BattleFormat;
    result: BattlePlayerResult;
    score: number;
    answeredQuestions: number;
    assignedQuestions: number;
  }) {
    const completionRatio =
      params.assignedQuestions === 0
        ? 0
        : params.answeredQuestions / params.assignedQuestions;

    const rewards: Array<{
      type: RewardLedgerType;
      amount: number;
      reason: string;
    }> = [];

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
      });
    }

    rewards.push({
      type: RewardLedgerType.RESULT,
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

    return rewards;
  }
}