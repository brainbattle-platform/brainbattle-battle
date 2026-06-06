import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { UserWalletClient } from '../auth/user-wallet.client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettlementPayloadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userWalletClient: UserWalletClient,
  ) {}

  async buildBattleSettlementPayload(battleId: string) {
    const battle = await this.prisma.battleSession.findUniqueOrThrow({
      where: { id: battleId },
      include: {
        players: true,
        settlement: true,
      },
    });

    if (!battle.settlement) {
      throw new BadRequestException('Battle settlement not found');
    }

    const ledgers = await this.prisma.rewardLedger.findMany({
      where: { battleId },
      orderBy: { createdAt: 'asc' },
    });

    const walletMap = new Map<string, string>();

    for (const player of battle.players) {
      const wallet = await this.userWalletClient.getWallet(player.userId);

      if (!wallet.walletAddress) {
        throw new ServiceUnavailableException(
          `Missing wallet address for user ${player.userId}`,
        );
      }

      walletMap.set(player.userId, wallet.walletAddress);
    }

    const payload = {
      battleId: battle.id,
      mode: battle.format,
      status: battle.status,
      finishedAt: battle.finishedAt,
      settlementHash: battle.settlement.settlementHash,
      players: battle.players.map((player) => ({
        userId: player.userId,
        walletAddress: walletMap.get(player.userId),
        result: player.result,
        score: player.score,
        team: player.team,
        role: player.role,
      })),
      rewards: ledgers.map((ledger) => ({
        userId: ledger.userId,
        walletAddress: walletMap.get(ledger.userId),
        type: ledger.type,
        amount: ledger.amount,
        balanceAfter: ledger.balanceAfter,
      })),
    };

    return {
      payload,
      payloadHash: this.hashPayload(payload),
    };
  }

  private hashPayload(payload: unknown) {
    return createHash('sha256')
      .update(this.stableStringify(payload))
      .digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (value === null || value === undefined) {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    if (typeof value === 'object') {
      const objectValue = value as Record<string, unknown>;
      const keys = Object.keys(objectValue).sort();

      return `{${keys
        .map(
          (key) =>
            `${JSON.stringify(key)}:${this.stableStringify(objectValue[key])}`,
        )
        .join(',')}}`;
    }

    return JSON.stringify(value);
  }
}