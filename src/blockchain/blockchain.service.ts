import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OnchainRecordStatus } from '@prisma/client';
import { ethers } from 'ethers';
import { env } from '../common/env';
import { PrismaService } from '../prisma/prisma.service';
import { SettlementPayloadService } from '../reward/settlement-payload.service';
import { BRAIN_BATTLE_ABI } from './brainbattle-abi';

@Injectable()
export class BlockchainService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settlementPayloadService: SettlementPayloadService,
  ) {}

  async recordBattleOnchain(battleId: string) {
    const existing = await this.prisma.onchainRecord.findUnique({
      where: { battleId },
    });

    if (existing?.status === OnchainRecordStatus.CONFIRMED) {
      return existing;
    }

    const { payload, payloadHash } =
      await this.settlementPayloadService.buildBattleSettlementPayload(battleId);

    if (!env.BLOCKCHAIN_ENABLED) {
      return this.prisma.onchainRecord.upsert({
        where: { battleId },
        create: {
          battleId,
          settlementHash: payload.settlementHash,
          payloadJson: payload,
          chainId: env.CHAIN_ID,
          contractAddress: env.CONTRACT_ADDRESS || 'DISABLED',
          status: OnchainRecordStatus.BLOCKED,
          errorMessage: 'BLOCKCHAIN_DISABLED',
        },
        update: {
          settlementHash: payload.settlementHash,
          payloadJson: payload,
          status: OnchainRecordStatus.BLOCKED,
          errorMessage: 'BLOCKCHAIN_DISABLED',
        },
      });
    }

    if (!env.RPC_URL || !env.PRIVATE_KEY || !env.CONTRACT_ADDRESS) {
      throw new ServiceUnavailableException(
        'Blockchain env is not fully configured',
      );
    }

    const rewards = payload.rewards
      .filter((reward) => reward.amount > 0)
      .map((reward) => ({
        player: reward.walletAddress,
        rewardType: this.mapRewardTypeToContract(reward.type),
        amount: BigInt(reward.amount),
      }));

    if (rewards.length === 0) {
      throw new BadRequestException('No positive rewards to record on-chain');
    }

    const provider = new ethers.JsonRpcProvider(env.RPC_URL);
    const signer = new ethers.Wallet(env.PRIVATE_KEY, provider);
    const contract = new ethers.Contract(
      env.CONTRACT_ADDRESS,
      BRAIN_BATTLE_ABI,
      signer,
    );

    const battleIdBytes32 = ethers.id(battleId);
    const resultHashBytes32 = `0x${payloadHash}`;

    const pending = await this.prisma.onchainRecord.upsert({
      where: { battleId },
      create: {
        battleId,
        settlementHash: payload.settlementHash,
        payloadJson: payload,
        chainId: env.CHAIN_ID,
        contractAddress: env.CONTRACT_ADDRESS,
        status: OnchainRecordStatus.PENDING,
      },
      update: {
        settlementHash: payload.settlementHash,
        payloadJson: payload,
        status: OnchainRecordStatus.PENDING,
        errorMessage: null,
      },
    });

    try {
      const tx = await contract.recordBattleResult(
        battleIdBytes32,
        resultHashBytes32,
        rewards,
      );

      await this.prisma.onchainRecord.update({
        where: { id: pending.id },
        data: {
          status: OnchainRecordStatus.SUBMITTED,
          txHash: tx.hash,
          submittedAt: new Date(),
        },
      });

      const receipt = await tx.wait();

      return this.prisma.onchainRecord.update({
        where: { id: pending.id },
        data: {
          status:
            receipt?.status === 1
              ? OnchainRecordStatus.CONFIRMED
              : OnchainRecordStatus.FAILED,
          blockNumber: receipt?.blockNumber
            ? BigInt(receipt.blockNumber)
            : undefined,
          confirmedAt: receipt?.status === 1 ? new Date() : undefined,
          errorMessage: receipt?.status === 1 ? null : 'Transaction reverted',
        },
      });
    } catch (error) {
      return this.prisma.onchainRecord.update({
        where: { id: pending.id },
        data: {
          status: OnchainRecordStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        },
      });
    }
  }

  async getOnchainRecord(battleId: string) {
    return this.prisma.onchainRecord.findUnique({
      where: { battleId },
    });
  }

  private mapRewardTypeToContract(type: string) {
    const map: Record<string, string> = {
      PARTICIPATION: 'ParticipationReward',
      WIN: 'WinReward',
      DRAW: 'DrawReward',
      LOSE: 'LoseReward',
      PERFORMANCE: 'PerformanceReward',
      STREAK: 'StreakBonus',
      SEASON: 'SeasonReward',
    };

    return map[type] ?? type;
  }
}