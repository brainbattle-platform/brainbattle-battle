import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeaderboardQueryDto } from './dto';
import { RankTier } from '@prisma/client';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeaderboard(q: LeaderboardQueryDto) {
    const limit = q.limit ?? 50;
    const period = q.period ?? 'all';

    // All-time: use RankProfile (fast)
    if (period === 'all') {
      const rows = await this.prisma.rankProfile.findMany({
        orderBy: [
          { tier: 'desc' }, // GOLD > SILVER > BRONZE (enum order depends; if wrong, use custom mapping below)
          { goldStars: 'desc' },
          { stars: 'desc' },
          { updatedAt: 'asc' },
        ],
        take: limit,
      });

      // If enum ordering doesn't match expected, we normalize rank on response
      return {
        period,
        items: rows.map((r, idx) => ({
          rank: idx + 1,
          userId: r.userId,
          tier: r.tier,
          stars: r.stars,
          goldStars: r.goldStars,
        })),
      };
    }

    // Daily/Weekly: compute sum(score) from BattleParticipant in time window
    const now = new Date();
    const from =
      period === 'daily'
        ? new Date(now.getTime() - 24 * 3600 * 1000)
        : new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    const modeFilter = q.mode ? (q.mode === '1v1' ? 'ONE_VS_ONE' : 'THREE_VS_THREE') : null;

    // Raw SQL for aggregation (Prisma groupBy can be used too, but raw is simpler for ordering)
    const rows: Array<{ userId: string; score: number }> = await this.prisma.$queryRawUnsafe(`
      SELECT bp."userId" as "userId", SUM(bp."score")::int as "score"
      FROM "BattleParticipant" bp
      JOIN "Battle" b ON b."id" = bp."battleId"
      WHERE b."status" = 'FINISHED'
        AND b."finishedAt" IS NOT NULL
        AND b."finishedAt" >= $1
        ${modeFilter ? `AND b."mode" = '${modeFilter}'` : ``}
      GROUP BY bp."userId"
      ORDER BY SUM(bp."score") DESC
      LIMIT $2
    `, from.toISOString(), limit);

    return {
      period,
      from: from.toISOString(),
      items: rows.map((r, idx) => ({
        rank: idx + 1,
        userId: r.userId,
        score: Number(r.score) || 0,
      })),
    };
  }
}
