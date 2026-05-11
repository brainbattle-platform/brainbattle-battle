import { Module } from '@nestjs/common';
import { RewardModule } from '../reward/reward.module';
import { RankController } from './rank.controller';
import { AdminRankController } from './admin-rank.controller';
import { RankRewardService } from './rank-reward.service';
import { RankService } from './rank.service';

@Module({
  imports: [RewardModule],
  controllers: [RankController, AdminRankController],
  providers: [RankService, RankRewardService],
  exports: [RankService, RankRewardService],
})
export class RankModule {}