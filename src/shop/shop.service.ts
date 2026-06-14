import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PlayerItemStatus,
  Prisma,
  RewardLedgerType,
  RewardSourceType,
  ShopItemCode,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_SHOP_ITEMS: Array<{
  code: ShopItemCode;
  name: string;
  description: string;
  costBp: number;
  sortOrder: number;
}> = [
  {
    code: ShopItemCode.STAR_PROTECTION,
    name: 'Star Protection',
    description: 'If you lose, your star is protected for one eligible battle.',
    costBp: 20,
    sortOrder: 1,
  },
  {
    code: ShopItemCode.DOUBLE_REWARD,
    name: 'Double Reward',
    description: 'Doubles positive BrainPoint rewards for one eligible finished battle.',
    costBp: 25,
    sortOrder: 2,
  },
  {
    code: ShopItemCode.RANK_SHIELD,
    name: 'Rank Shield',
    description: 'Protects against star loss for one eligible defeat.',
    costBp: 40,
    sortOrder: 3,
  },
];

@Injectable()
export class ShopService {
  private defaultShopItemsReady?: Promise<void>;

  constructor(private readonly prisma: PrismaService) {}

  async listShopItems() {
    await this.ensureDefaultShopItems();

    return this.prisma.shopItem.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getMyInventory(userId: string) {
    // Battle Home calls this together with rank, wallet and active-battle APIs.
    // Keep it lightweight so one slow shop/profile seed does not kill the whole
    // mobile Battle Arena with 503/P2028.
    await this.ensureDefaultShopItems();
    await this.ensureRewardProfile(userId);

    return this.prisma.playerInventoryItem.findMany({
      where: { userId },
      include: { item: true },
      orderBy: { acquiredAt: 'desc' },
    });
  }

  async purchaseItem(userId: string, itemCode: ShopItemCode) {
    await this.ensureDefaultShopItems();

    return this.prisma.$transaction(async (tx) => {
      await this.ensureRewardProfileTx(tx, userId);

      const item = await tx.shopItem.findUnique({ where: { code: itemCode } });

      if (!item || !item.isActive) {
        throw new NotFoundException('Shop item not found or inactive');
      }

      const wallet = await tx.playerRewardWallet.findUniqueOrThrow({
        where: { userId },
      });

      if (wallet.brainPointBalance < item.costBp) {
        throw new BadRequestException('Insufficient BrainPoint balance');
      }

      const nextBalance = wallet.brainPointBalance - item.costBp;

      await tx.playerRewardWallet.update({
        where: { userId },
        data: {
          brainPointBalance: nextBalance,
          totalSpent: { increment: item.costBp },
        },
      });

      const inventoryItem = await tx.playerInventoryItem.create({
        data: {
          userId,
          itemCode,
          status: PlayerItemStatus.AVAILABLE,
          metadataJson: {
            purchasedCostBp: item.costBp,
          },
        },
        include: { item: true },
      });

      await tx.rewardLedger.create({
        data: {
          userId,
          sourceType: RewardSourceType.SHOP,
          type: RewardLedgerType.ADMIN,
          amount: -item.costBp,
          balanceAfter: nextBalance,
          reason: `Purchased ${item.code}`,
          metadataJson: {
            itemCode: item.code,
            inventoryItemId: inventoryItem.id,
          },
        },
      });

      return inventoryItem;
    });
  }

  async activateItem(userId: string, inventoryItemId: string) {
    return this.prisma.$transaction(async (tx) => {
      const inventoryItem = await tx.playerInventoryItem.findFirst({
        where: {
          id: inventoryItemId,
          userId,
        },
        include: { item: true },
      });

      if (!inventoryItem) {
        throw new NotFoundException('Inventory item not found');
      }

      if (inventoryItem.status !== PlayerItemStatus.AVAILABLE) {
        throw new BadRequestException('Only available items can be activated');
      }

      await tx.playerInventoryItem.updateMany({
        where: {
          userId,
          itemCode: inventoryItem.itemCode,
          status: PlayerItemStatus.ACTIVE,
        },
        data: {
          status: PlayerItemStatus.AVAILABLE,
          activatedAt: null,
        },
      });

      return tx.playerInventoryItem.update({
        where: { id: inventoryItem.id },
        data: {
          status: PlayerItemStatus.ACTIVE,
          activatedAt: new Date(),
        },
        include: { item: true },
      });
    });
  }

  async adminListInventory(userId?: string) {
    return this.prisma.playerInventoryItem.findMany({
      where: userId ? { userId } : undefined,
      include: { item: true },
      orderBy: { acquiredAt: 'desc' },
      take: 200,
    });
  }

  async consumeDoubleRewardIfAvailable(
    tx: Prisma.TransactionClient,
    userId: string,
    battleId: string,
  ) {
    return this.consumeFirstUsableItem(
      tx,
      userId,
      [ShopItemCode.DOUBLE_REWARD],
      battleId,
    );
  }

  async consumeRankProtectionIfEligible(
    tx: Prisma.TransactionClient,
    userId: string,
    battleId: string,
  ) {
    return this.consumeFirstUsableItem(
      tx,
      userId,
      [ShopItemCode.RANK_SHIELD, ShopItemCode.STAR_PROTECTION],
      battleId,
    );
  }

  private async consumeFirstUsableItem(
    tx: Prisma.TransactionClient,
    userId: string,
    itemCodes: ShopItemCode[],
    battleId: string,
  ) {
    const item = await tx.playerInventoryItem.findFirst({
      where: {
        userId,
        itemCode: { in: itemCodes },
        status: { in: [PlayerItemStatus.ACTIVE, PlayerItemStatus.AVAILABLE] },
      },
      orderBy: [
        { status: 'asc' },
        { activatedAt: 'asc' },
        { acquiredAt: 'asc' },
      ],
    });

    if (!item) {
      return null;
    }

    return tx.playerInventoryItem.update({
      where: { id: item.id },
      data: {
        status: PlayerItemStatus.USED,
        usedAt: new Date(),
        battleId,
        metadataJson: {
          consumedByBattleId: battleId,
        },
      },
    });
  }

  private async ensureDefaultShopItems() {
    // Mobile Battle Home can request shop/rank/wallet/room/battle in parallel.
    // With Supabase pooler and small local pools, running all seed upserts in
    // Promise.all starves Prisma connections and causes P2024/P2028.
    //
    // Seed once per process and do it sequentially. The table is tiny (3 rows),
    // so this is faster and much safer for demo/prod-like environments.
    if (!this.defaultShopItemsReady) {
      this.defaultShopItemsReady = this.seedDefaultShopItems().catch((error) => {
        this.defaultShopItemsReady = undefined;
        throw error;
      });
    }

    await this.defaultShopItemsReady;
  }

  private async seedDefaultShopItems() {
    for (const item of DEFAULT_SHOP_ITEMS) {
      await this.prisma.shopItem.upsert({
        where: { code: item.code },
        create: item,
        update: item,
      });
    }
  }

  private async ensureRewardProfile(userId: string) {
    // Do not wrap these idempotent upserts in an interactive transaction.
    // On Supabase/pooled PostgreSQL this endpoint was the concrete source of
    // Prisma P2028 during mobile Battle Home boot. The operations are safe to
    // retry independently because both tables use userId as the primary key.
    await this.prisma.playerRankProfile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    await this.prisma.playerRewardWallet.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  private async ensureRewardProfileTx(tx: Prisma.TransactionClient, userId: string) {
    await tx.playerRankProfile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    await tx.playerRewardWallet.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }
}
