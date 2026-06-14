import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { ShopService } from './shop.service';

@ApiTags('admin/shop')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('admin/shop')
export class AdminShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get('items')
  @ApiOperation({ summary: 'Admin list shop items' })
  listItems(@CurrentUser() user: AuthUser) {
    this.assertAdmin(user);
    return this.shopService.listShopItems();
  }

  @Get('inventory')
  @ApiOperation({ summary: 'Admin inspect inventory items' })
  listInventory(@CurrentUser() user: AuthUser, @Query('userId') userId?: string) {
    this.assertAdmin(user);
    return this.shopService.adminListInventory(userId);
  }

  private assertAdmin(user: AuthUser) {
    const roles = user.roles ?? [];
    if (!roles.includes('admin') && !roles.includes('ADMIN')) {
      throw new ForbiddenException('Admin role required');
    }
  }
}
