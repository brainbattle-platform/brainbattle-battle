import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OnchainRecordStatus, Prisma } from '@prisma/client';
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
      if (existing.txHash) {
        await this.syncRewardLedgerTxHash(battleId, existing.txHash);
      }

      return existing;
    }

    const { payload, payloadHash } =
      await this.settlementPayloadService.buildBattleSettlementPayload(battleId);

    const settlementHash = payload.settlementHash ?? payloadHash;

    if (!settlementHash) {
      throw new BadRequestException('Missing settlement hash');
    }

    const payloadJson = payload as Prisma.InputJsonValue;

    if (!env.BLOCKCHAIN_ENABLED) {
      return this.prisma.onchainRecord.upsert({
        where: { battleId },
        create: {
          battleId,
          settlementHash,
          payloadJson,
          chainId: env.CHAIN_ID,
          contractAddress: env.CONTRACT_ADDRESS || 'DISABLED',
          status: OnchainRecordStatus.BLOCKED,
          errorMessage: 'BLOCKCHAIN_DISABLED',
        },
        update: {
          settlementHash,
          payloadJson,
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

    const rewards = payload.players.map((player) => ({
      player: player.player,
      outcome: player.outcomeValue,
      totalBp: BigInt(player.totalBp),
      breakdown: player.breakdown.map((item) => ({
        rewardType: item.rewardType,
        amountBp: BigInt(item.amountBp),
      })),
    }));

    if (rewards.length === 0) {
      throw new BadRequestException('No rewards available for on-chain recording');
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
        settlementHash,
        payloadJson,
        chainId: env.CHAIN_ID,
        contractAddress: env.CONTRACT_ADDRESS,
        status: OnchainRecordStatus.PENDING,
      },
      update: {
        settlementHash,
        payloadJson,
        status: OnchainRecordStatus.PENDING,
        errorMessage: null,
      },
    });

    try {
      const tx = await contract.recordBattleResult(
        battleIdBytes32,
        payload.modeValue,
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
      const confirmed = receipt?.status === 1;

      if (confirmed) {
        await this.syncRewardLedgerTxHash(battleId, tx.hash);
      }

      return this.prisma.onchainRecord.update({
        where: { id: pending.id },
        data: {
          status: confirmed
            ? OnchainRecordStatus.CONFIRMED
            : OnchainRecordStatus.FAILED,
          blockNumber: receipt?.blockNumber
            ? BigInt(receipt.blockNumber)
            : undefined,
          confirmedAt: confirmed ? new Date() : undefined,
          errorMessage: confirmed ? null : 'Transaction reverted',
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

  private async syncRewardLedgerTxHash(battleId: string, txHash: string) {
    await this.prisma.rewardLedger.updateMany({
      where: {
        battleId,
        onChainTxHash: null,
      },
      data: {
        onChainTxHash: txHash,
      },
    });
  }
}