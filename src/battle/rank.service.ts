import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RankTier, WinnerSide } from '@prisma/client';
import { BattleGateway } from '../ws/battle.gateway';

const BRONZE_MAX = 3;
const SILVER_MAX = 4;

function tierToNumber(t: RankTier) {
  if (t === RankTier.BRONZE) return 1;
  if (t === RankTier.SILVER) return 2;
  return 3;
}

@Injectable()
export class RankService {
  constructor(private readonly prisma: PrismaService, private readonly ws: BattleGateway) {}

  async getProfile(userId: string) {
    const p = await this.prisma.rankProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return p;
  }

  async getHistory(userId: string) {
    const rows = await this.prisma.rankHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return { items: rows };
  }

  async applyBattleRank(battleId: string) {
    const battle = await this.prisma.battle.findUnique({
      where: { id: battleId },
      include: { participants: true },
    });
    if (!battle || !battle.winnerSide) return;

    // determine win/lose per user by team
    const winnerTeam = battle.winnerSide === WinnerSide.A ? 'A' : battle.winnerSide === WinnerSide.B ? 'B' : null;

    for (const p of battle.participants) {
      const isDraw = battle.winnerSide === WinnerSide.DRAW;
      const isWin = !isDraw && winnerTeam === p.team;
      const delta = isDraw ? 0 : isWin ? +1 : -1;

      await this.applyDelta(p.userId, battleId, delta, isWin ? 'WIN' : isDraw ? 'DRAW' : 'LOSE');
    }
  }

  private async applyDelta(userId: string, battleId: string, delta: number, reason: string) {
    const before = await this.prisma.rankProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    const bTier = before.tier;
    const bStars = before.stars;
    const bGold = before.goldStars;

    let tier = before.tier;
    let stars = before.stars;
    let goldStars = before.goldStars;

    if (delta === 0) {
      // no change
    } else if (delta > 0) {
      // WIN
      if (tier === RankTier.BRONZE) {
        if (stars < BRONZE_MAX) stars++;
        else { tier = RankTier.SILVER; stars = 0; }
      } else if (tier === RankTier.SILVER) {
        if (stars < SILVER_MAX) stars++;
        else { tier = RankTier.GOLD; stars = 0; goldStars = 0; }
      } else {
        goldStars++;
      }
    } else {
      // LOSE
      if (tier === RankTier.BRONZE) {
        stars = Math.max(0, stars - 1); // BRONZE 0 doesn't go negative
      } else if (tier === RankTier.SILVER) {
        if (stars > 0) stars--;
        else { tier = RankTier.BRONZE; stars = BRONZE_MAX - 1; }
      } else {
        // GOLD lose: decrease goldStars if >0 else drop to SILVER
        if (goldStars > 0) goldStars--;
        else { tier = RankTier.SILVER; stars = SILVER_MAX; goldStars = 0; }
      }
    }

    const after = await this.prisma.rankProfile.update({
      where: { userId },
      data: { tier, stars, goldStars },
    });

    await this.prisma.rankHistory.create({
      data: {
        userId,
        battleId,
        delta,
        tierBefore: bTier,
        starsBefore: bStars,
        goldBefore: bGold,
        tierAfter: after.tier,
        starsAfter: after.stars,
        goldAfter: after.goldStars,
        reason,
      },
    });

    this.ws.emitRankUpdated(userId, { tier: after.tier, stars: after.stars, goldStars: after.goldStars });
  }
}
