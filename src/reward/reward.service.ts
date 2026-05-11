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
    constructor(private readonly prisma: PrismaService) { }

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

    async getMyLedger(
        userId: string,
        query: { page: number; limit: number },
    ) {
        const page = Math.max(1, query.page || 1);
        const limit = Math.min(100, Math.max(1, query.limit || 20));
        const skip = (page - 1) * limit;

        const [total, items] = await this.prisma.$transaction([
            this.prisma.rewardLedger.count({
                where: { userId },
            }),
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

    async adminGetLedger(
        userId: string,
        query: { page: number; limit: number },
    ) {
        return this.getMyLedger(userId, query);
    }
}