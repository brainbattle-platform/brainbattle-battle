import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { ActivateItemDto, PurchaseItemDto } from './dto';
import { ShopService } from './shop.service';

@ApiTags('shop')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('shop')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get('items')
  @ApiOperation({ summary: 'List active BrainPoint shop items' })
  listItems() {
    return this.shopService.listShopItems();
  }

  @Get('me/inventory')
  @ApiOperation({ summary: 'List current player inventory' })
  getInventory(@CurrentUser() user: AuthUser) {
    return this.shopService.getMyInventory(user.id);
  }

  @Post('purchase')
  @ApiOperation({ summary: 'Purchase an item with BrainPoint' })
  purchase(@CurrentUser() user: AuthUser, @Body() dto: PurchaseItemDto) {
    return this.shopService.purchaseItem(user.id, dto.itemCode);
  }

  @Post('activate')
  @ApiOperation({ summary: 'Activate one inventory item for the next eligible battle' })
  activate(@CurrentUser() user: AuthUser, @Body() dto: ActivateItemDto) {
    return this.shopService.activateItem(user.id, dto.inventoryItemId);
  }
}
