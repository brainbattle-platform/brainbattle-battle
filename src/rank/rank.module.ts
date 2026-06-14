import { Module } from '@nestjs/common';
import { RewardModule } from '../reward/reward.module';
import { ShopModule } from '../shop/shop.module';
import { AdminRankController } from './admin-rank.controller';
import { AuthProfileSyncClient } from './auth-profile-sync.client';
import { RankController } from './rank.controller';
import { RankRewardService } from './rank-reward.service';
import { RankService } from './rank.service';

@Module({
  imports: [RewardModule, ShopModule],
  controllers: [RankController, AdminRankController],
  providers: [RankService, RankRewardService, AuthProfileSyncClient],
  exports: [RankService, RankRewardService],
})
export class RankModule {}