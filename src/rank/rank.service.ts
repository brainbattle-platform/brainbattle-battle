import { Injectable } from '@nestjs/common';
import { BattlePlayerResult, Prisma, RankTier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RANK_ORDER, RANK_STAR_CONFIG } from './rank.constants';

@Injectable()
export class RankService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateProfile(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    let profile = await tx.playerRankProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      profile = await tx.playerRankProfile.create({
        data: {
          userId,
        },
      });

      await tx.playerRewardWallet.create({
        data: {
          userId,
        },
      });
    }

    return profile;
  }

  applyResult(
    currentTier: RankTier,
    currentStars: number,
    result: BattlePlayerResult,
  ) {
    if (result === BattlePlayerResult.DRAW) {
      return {
        newTier: currentTier,
        newStars: currentStars,
        delta: 0,
      };
    }

    if (result === BattlePlayerResult.WIN) {
      return this.applyWin(currentTier, currentStars);
    }

    return this.applyLose(currentTier, currentStars);
  }

  private applyWin(currentTier: RankTier, currentStars: number) {
    if (currentTier === RankTier.CHALLENGER) {
      return {
        newTier: currentTier,
        newStars: currentStars + 1,
        delta: 1,
      };
    }

    const maxStars = RANK_STAR_CONFIG[currentTier]!;

    if (currentStars + 1 <= maxStars) {
      return {
        newTier: currentTier,
        newStars: currentStars + 1,
        delta: 1,
      };
    }

    const currentIndex = RANK_ORDER.indexOf(currentTier);
    const nextTier = RANK_ORDER[currentIndex + 1];

    return {
      newTier: nextTier,
      newStars: 0,
      delta: 1,
    };
  }

  private applyLose(currentTier: RankTier, currentStars: number) {
    if (currentTier === RankTier.BRONZE) {
      return {
        newTier: currentTier,
        newStars: Math.max(0, currentStars - 1),
        delta: currentStars > 0 ? -1 : 0,
      };
    }

    if (currentTier === RankTier.CHALLENGER) {
      return {
        newTier: currentTier,
        newStars: Math.max(0, currentStars - 1),
        delta: currentStars > 0 ? -1 : 0,
      };
    }

    if (currentStars > 0) {
      return {
        newTier: currentTier,
        newStars: currentStars - 1,
        delta: -1,
      };
    }

    const currentIndex = RANK_ORDER.indexOf(currentTier);
    const previousTier = RANK_ORDER[currentIndex - 1];
    const previousMaxStars = RANK_STAR_CONFIG[previousTier]!;

    return {
      newTier: previousTier,
      newStars: previousMaxStars - 1,
      delta: -1,
    };
  }
}