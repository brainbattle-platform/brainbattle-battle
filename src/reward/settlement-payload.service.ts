import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  BattleFormat,
  BattlePlayerResult,
  BattleRole,
  RewardLedgerType,
  RoomTeam,
} from '@prisma/client';
import { createHash } from 'crypto';
import { UserWalletClient } from '../auth/user-wallet.client';
import { PrismaService } from '../prisma/prisma.service';

type SettlementRewardBreakdownItem = {
  rewardType: number;
  rewardTypeLabel: string;
  amountBp: number;
  ledgerIds: string[];
};

type SettlementPlayerPayload = {
  userId: string;
  player: string;
  outcome: BattlePlayerResult;
  outcomeValue: number;
  totalBp: number;
  breakdown: SettlementRewardBreakdownItem[];
  rewardEntries: Array<{
    id: string;
    type: RewardLedgerType;
    amount: number;
    balanceAfter: number;
    reason: string | null;
  }>;
};

type BattleSettlementPayload = {
  battleId: string;
  mode: BattleFormat;
  modeValue: number;
  status: string;
  finishedAt: string | null;
  settlementHash: string | null;
  players: SettlementPlayerPayload[];
};

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
      throw new BadRequestException('Battle settlement not found. Finish the battle before recording on-chain.');
    }

    if (battle.status !== 'FINISHED') {
      throw new BadRequestException('Only FINISHED battles can be recorded on-chain');
    }

    const expectedPlayerCount = battle.format === 'DUEL_1V1' ? 2 : 6;

    if (battle.players.length !== expectedPlayerCount) {
      throw new BadRequestException(
        `Invalid player count for ${battle.format}. Expected ${expectedPlayerCount}, got ${battle.players.length}`,
      );
    }

    const ledgers = await this.prisma.rewardLedger.findMany({
      where: { battleId },
      orderBy: { createdAt: 'asc' },
    });

    const ledgersByUserId = new Map<string, typeof ledgers>();

    for (const ledger of ledgers) {
      const current = ledgersByUserId.get(ledger.userId) ?? [];
      current.push(ledger);
      ledgersByUserId.set(ledger.userId, current);
    }

    const walletMap = new Map<string, string>();

    for (const player of battle.players) {
      const wallet = await this.userWalletClient.getWallet(player.userId);

      if (!wallet.walletAddress) {
        throw new ServiceUnavailableException(
          `Missing primary wallet address for user ${player.userId}. Link a wallet before on-chain settlement.`,
        );
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(wallet.walletAddress)) {
        throw new BadRequestException(
          `Invalid EVM wallet address for user ${player.userId}`,
        );
      }

      walletMap.set(player.userId, wallet.walletAddress);
    }

    const sortedPlayers = [...battle.players].sort((a, b) =>
      this.compareBattlePlayers(a.team, a.role, a.userId, b.team, b.role, b.userId),
    );

    const payload: BattleSettlementPayload = {
      battleId: battle.id,
      mode: battle.format,
      modeValue: this.mapBattleModeToSolidity(battle.format),
      status: battle.status,
      finishedAt: battle.finishedAt?.toISOString() ?? null,
      settlementHash: battle.settlement.settlementHash,
      players: sortedPlayers.map((player) => {
        if (!player.result) {
          throw new BadRequestException(
            `Missing battle result for player ${player.userId}`,
          );
        }

        const playerLedgers = ledgersByUserId.get(player.userId) ?? [];
        const rewardEntries = playerLedgers.map((ledger) => ({
          id: ledger.id,
          type: ledger.type,
          amount: ledger.amount,
          balanceAfter: ledger.balanceAfter,
          reason: ledger.reason,
        }));

        const breakdown = this.groupBreakdownItems(playerLedgers);
        const totalBp = breakdown.reduce((sum, item) => sum + item.amountBp, 0);

        return {
          userId: player.userId,
          player: walletMap.get(player.userId) ?? '',
          outcome: player.result,
          outcomeValue: this.mapBattleOutcomeToSolidity(player.result),
          totalBp,
          breakdown,
          rewardEntries,
        };
      }),
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

  private compareBattlePlayers(
    teamA: RoomTeam,
    roleA: BattleRole | null,
    userIdA: string,
    teamB: RoomTeam,
    roleB: BattleRole | null,
    userIdB: string,
  ) {
    const teamOrder: Record<RoomTeam, number> = {
      [RoomTeam.A]: 0,
      [RoomTeam.B]: 1,
    };

    const roleOrder: Record<BattleRole, number> = {
      [BattleRole.GRAMMAR]: 0,
      [BattleRole.LISTENING]: 1,
      [BattleRole.VOCABULARY]: 2,
    };

    const teamDiff = teamOrder[teamA] - teamOrder[teamB];

    if (teamDiff !== 0) {
      return teamDiff;
    }

    const roleRankA = roleA ? roleOrder[roleA] : 99;
    const roleRankB = roleB ? roleOrder[roleB] : 99;
    const roleDiff = roleRankA - roleRankB;

    if (roleDiff !== 0) {
      return roleDiff;
    }

    return userIdA.localeCompare(userIdB);
  }

  private groupBreakdownItems(
    ledgers: Array<{
      id: string;
      type: RewardLedgerType;
      amount: number;
      balanceAfter: number;
      reason: string | null;
    }>,
  ) {
    const grouped = new Map<number, SettlementRewardBreakdownItem>();

    for (const ledger of ledgers) {
      if (ledger.amount <= 0) {
        continue;
      }

      const rewardType = this.mapRewardTypeToSolidity(ledger.type);

      if (rewardType === null) {
        continue;
      }

      const existing = grouped.get(rewardType);

      if (existing) {
        existing.amountBp += ledger.amount;
        existing.ledgerIds.push(ledger.id);
        continue;
      }

      grouped.set(rewardType, {
        rewardType,
        rewardTypeLabel: ledger.type,
        amountBp: ledger.amount,
        ledgerIds: [ledger.id],
      });
    }

    return [...grouped.values()].sort((a, b) => a.rewardType - b.rewardType);
  }

  private mapBattleModeToSolidity(mode: BattleFormat) {
    return mode === BattleFormat.DUEL_1V1 ? 0 : 1;
  }

  private mapBattleOutcomeToSolidity(outcome: BattlePlayerResult) {
    switch (outcome) {
      case BattlePlayerResult.WIN:
        return 0;
      case BattlePlayerResult.LOSE:
        return 1;
      case BattlePlayerResult.DRAW:
        return 2;
      default:
        return 4;
    }
  }

  private mapRewardTypeToSolidity(type: RewardLedgerType) {
    switch (type) {
      case RewardLedgerType.PARTICIPATION:
        return 0;
      case RewardLedgerType.WIN:
        return 1;
      case RewardLedgerType.DRAW:
        return 2;
      case RewardLedgerType.LOSE:
        return 3;
      case RewardLedgerType.PERFORMANCE:
        return 4;
      case RewardLedgerType.STREAK:
        return 5;
      case RewardLedgerType.SEASON:
        return 6;
      default:
        return null;
    }
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