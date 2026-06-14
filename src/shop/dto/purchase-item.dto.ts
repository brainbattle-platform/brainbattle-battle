import { IsEnum } from 'class-validator';
import { ShopItemCode } from '@prisma/client';

export class PurchaseItemDto {
  @IsEnum(ShopItemCode)
  itemCode!: ShopItemCode;
}
