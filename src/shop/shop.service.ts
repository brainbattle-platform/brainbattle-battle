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
    // Pure read endpoint: never seed/upsert here. Battle Home calls inventory
    // together with rank/reward/room APIs; any write here amplifies Supabase
    // pooler pressure and breaks the live demo under multiple devices.
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
    // Seed once per process using at most two DB round-trips. The previous
    // implementation did one upsert per item on every cold dashboard load;
    // with Supabase session pooler this repeatedly hit EMAXCONNSESSION.
    if (!this.defaultShopItemsReady) {
      this.defaultShopItemsReady = this.seedDefaultShopItems().catch((error) => {
        this.defaultShopItemsReady = undefined;
        throw error;
      });
    }

    await this.defaultShopItemsReady;
  }

  private async seedDefaultShopItems() {
    const codes = DEFAULT_SHOP_ITEMS.map((item) => item.code);
    const existingCount = await this.prisma.shopItem.count({
      where: { code: { in: codes } },
    });

    if (existingCount >= DEFAULT_SHOP_ITEMS.length) {
      return;
    }

    await this.prisma.shopItem.createMany({
      data: DEFAULT_SHOP_ITEMS,
      skipDuplicates: true,
    });
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
