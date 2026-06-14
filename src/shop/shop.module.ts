import { Module } from '@nestjs/common';
import { AdminShopController } from './admin-shop.controller';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({
  controllers: [ShopController, AdminShopController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}
