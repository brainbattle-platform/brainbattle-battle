import { BattleFormat, BattlePlayerResult } from '@prisma/client';

export const PARTICIPATION_THRESHOLD = 0.7;

export const PARTICIPATION_REWARD = 2;
export const AFK_PENALTY = -5;

export const RESULT_REWARD: Record<
  BattleFormat,
  Record<BattlePlayerResult, number>
> = {
  DUEL_1V1: {
    WIN: 8,
    DRAW: 4,
    LOSE: 2,
  },

  TEAM_3V3: {
    WIN: 6,
    DRAW: 3,
    LOSE: 2,
  },
};

export function resolvePerformanceReward(score: number) {
  if (score >= 800) return 4;
  if (score >= 600) return 3;
  if (score >= 400) return 2;
  return 0;
}