import { Injectable } from '@nestjs/common';
import {
  BattlePlayerResult,
  BattleParticipationStatus,
  RewardSourceType,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RewardService } from '../reward/reward.service';
import { ShopService } from '../shop/shop.service';
import { AuthProfileSyncClient } from './auth-profile-sync.client';
import { RankService } from './rank.service';

@Injectable()
export class RankRewardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rankService: RankService,
    private readonly rewardService: RewardService,
    private readonly shopService: ShopService,
    private readonly authProfileSyncClient: AuthProfileSyncClient,
  ) { }

  async processBattleResult(battleId: string) {
    const existingSettlement = await this.prisma.battleSettlement.findUnique({
      where: { battleId },
    });

    if (existingSettlement) {
      await this.syncProfilesAfterSettlement(battleId);
      return existingSettlement;
    }

    // Reward calculation reads historical ledgers/battles for daily cap and
    // anti-farm rules. Do those reads before opening the settlement transaction;
    // otherwise Prisma may need a second connection while an interactive
    // transaction is held, which is risky on Supabase/pooled PostgreSQL.
    const rewardSourceBattle = await this.prisma.battleSession.findUniqueOrThrow({
      where: { id: battleId },
      include: {
        players: true,
        questions: true,
        submissions: true,
      },
    });

    const rewardPlanByUserId = new Map<
      string,
      Awaited<ReturnType<RewardService['calculateRewards']>>
    >();

    for (const player of rewardSourceBattle.players) {
      if (!player.result) {
        continue;
      }

      const assignedQuestions = rewardSourceBattle.questions.filter((question) => {
        if (rewardSourceBattle.format === 'DUEL_1V1') {
          return true;
        }

        return question.assignedRole === player.role;
      }).length;

      const answeredQuestions = rewardSourceBattle.submissions.filter(
        (submission) => submission.userId === player.userId,
      ).length;

      const opponentUserIds = rewardSourceBattle.players
        .filter((item) => item.team !== player.team)
        .map((item) => item.userId);

      rewardPlanByUserId.set(
        player.userId,
        await this.rewardService.calculateRewards({
          userId: player.userId,
          battleId: rewardSourceBattle.id,
          format: rewardSourceBattle.format,
          result: player.result,
          score: player.score,
          answeredQuestions,
          assignedQuestions,
          opponentUserIds,
        }),
      );
    }

    const settlement = await this.prisma.$transaction(async (tx) => {
      const battle = await tx.battleSession.findUniqueOrThrow({
        where: { id: battleId },
        include: {
          players: true,
          questions: true,
          submissions: true,
        },
      });

      const settlementHash = createHash('sha256')
        .update(`${battle.id}:${battle.finishedAt?.toISOString()}`)
        .digest('hex');

      for (const player of battle.players) {
        if (!player.result) {
          continue;
        }

        const assignedQuestions = battle.questions.filter((question) => {
          if (battle.format === 'DUEL_1V1') {
            return true;
          }

          return question.assignedRole === player.role;
        }).length;

        const answeredQuestions = battle.submissions.filter(
          (submission) => submission.userId === player.userId,
        ).length;

        const participationStatus =
          answeredQuestions === 0
            ? BattleParticipationStatus.AFK
            : BattleParticipationStatus.NORMAL;

        await tx.battlePlayer.update({
          where: {
            battleId_userId: {
              battleId: battle.id,
              userId: player.userId,
            },
          },
          data: {
            participationStatus,
          },
        });

        const profile = await this.rankService.getOrCreateProfile(
          tx,
          player.userId,
        );

        const rankProtectionItem =
          player.result === BattlePlayerResult.LOSE
            ? await this.shopService.consumeRankProtectionIfEligible(
                tx,
                player.userId,
                battle.id,
              )
            : null;

        const rankResult = rankProtectionItem
          ? {
              newTier: profile.rankTier,
              newStars: profile.stars,
              delta: 0,
            }
          : this.rankService.applyResult(
              profile.rankTier,
              profile.stars,
              player.result,
            );

        const newBestTier =
          this.compareTier(rankResult.newTier, profile.bestRankTier) > 0
            ? rankResult.newTier
            : profile.bestRankTier;

        const newBestStars =
          rankResult.newTier === newBestTier
            ? Math.max(profile.bestStars, rankResult.newStars)
            : profile.bestStars;

        const nextStreak =
          player.result === BattlePlayerResult.WIN
            ? profile.currentStreak + 1
            : 0;

        await tx.playerRankProfile.update({
          where: {
            userId: player.userId,
          },
          data: {
            rankTier: rankResult.newTier,
            stars: rankResult.newStars,

            totalBattles: {
              increment: 1,
            },

            winCount: {
              increment: player.result === BattlePlayerResult.WIN ? 1 : 0,
            },

            drawCount: {
              increment: player.result === BattlePlayerResult.DRAW ? 1 : 0,
            },

            loseCount: {
              increment: player.result === BattlePlayerResult.LOSE ? 1 : 0,
            },

            currentStreak: nextStreak,
            bestStreak: Math.max(profile.bestStreak, nextStreak),

            bestRankTier: newBestTier,
            bestStars: newBestStars,
          },
        });

        await tx.rankChangeLog.create({
          data: {
            userId: player.userId,
            battleId: battle.id,

            oldRankTier: profile.rankTier,
            oldStars: profile.stars,

            newRankTier: rankResult.newTier,
            newStars: rankResult.newStars,

            result: player.result,
            starDelta: rankResult.delta,
            reason: rankProtectionItem
              ? `Protected by ${rankProtectionItem.itemCode}`
              : undefined,
          },
        });

        const rewards = rewardPlanByUserId.get(player.userId) ?? [];

        const doubleRewardItem = await this.shopService.consumeDoubleRewardIfAvailable(
          tx,
          player.userId,
          battle.id,
        );

        const effectiveRewards = doubleRewardItem
          ? rewards.map((reward) => {
              if (reward.amount <= 0) {
                return reward;
              }

              return {
                ...reward,
                amount: reward.amount * 2,
                reason: `${reward.reason} doubled by ${doubleRewardItem.itemCode}`,
                metadata: {
                  ...reward.metadata,
                  doubleRewardItemId: doubleRewardItem.id,
                  doubleRewardApplied: true,
                },
              };
            })
          : rewards;

        const wallet = await tx.playerRewardWallet.findUniqueOrThrow({
          where: {
            userId: player.userId,
          },
        });

        let balance = wallet.brainPointBalance;

        for (const reward of effectiveRewards) {
          balance += reward.amount;

          await tx.rewardLedger.create({
            data: {
              userId: player.userId,
              battleId: battle.id,

              sourceType: RewardSourceType.BATTLE,

              type: reward.type,
              amount: reward.amount,
              balanceAfter: balance,

              reason: reward.reason,
              metadataJson: reward.metadata
                ? (reward.metadata as Prisma.InputJsonValue)
                : undefined,

              settlementHash,
            },
          });
        }

        await tx.playerRewardWallet.update({
          where: {
            userId: player.userId,
          },
          data: {
            brainPointBalance: balance,

            totalEarned: {
              increment: effectiveRewards
                .filter((item) => item.amount > 0)
                .reduce((sum, item) => sum + item.amount, 0),
            },

            totalSpent: {
              increment: Math.abs(
                effectiveRewards
                  .filter((item) => item.amount < 0)
                  .reduce((sum, item) => sum + item.amount, 0),
              ),
            },
          },
        });
      }

      return tx.battleSettlement.create({
        data: {
          battleId: battle.id,
          processedAt: new Date(),
          rankProcessed: true,
          rewardProcessed: true,
          settlementHash,
        },
      });
    });

    await this.syncProfilesAfterSettlement(battleId);

    return settlement;
  }

  private async syncProfilesAfterSettlement(battleId: string) {
    const battle = await this.prisma.battleSession.findUniqueOrThrow({
      where: { id: battleId },
      include: {
        players: true,
      },
    });

    for (const player of battle.players) {
      const profile = await this.prisma.playerRankProfile.findUnique({
        where: {
          userId: player.userId,
        },
        include: {
          rewardWallet: true,
        },
      });

      if (!profile) {
        continue;
      }

      await this.authProfileSyncClient.syncRankProfile({
        userId: player.userId,
        rankTier: profile.rankTier,
        stars: profile.stars,
        seasonId: profile.seasonId,
        winCount: profile.winCount,
        drawCount: profile.drawCount,
        loseCount: profile.loseCount,
        totalBattles: profile.totalBattles,
        brainPointBalance: profile.rewardWallet?.brainPointBalance ?? 0,
      });
    }
  }

  private compareTier(a: string, b: string) {
    const order = ['BRONZE', 'SILVER', 'GOLD', 'CHALLENGER'];

    return order.indexOf(a) - order.indexOf(b);
  }
}