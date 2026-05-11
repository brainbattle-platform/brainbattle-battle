import { Module } from '@nestjs/common';
import { AdminRewardController } from './admin-reward.controller';
import { RewardController } from './reward.controller';
import { RewardService } from './reward.service';

@Module({
  controllers: [RewardController, AdminRewardController],
  providers: [RewardService],
  exports: [RewardService],
})
export class RewardModule {}