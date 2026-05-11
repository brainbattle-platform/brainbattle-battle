import { Module } from '@nestjs/common';
import { AdminRewardController } from './admin-reward.controller';
import { RewardController } from './reward.controller';
import { RewardService } from './reward.service';
import { SettlementPayloadService } from './settlement-payload.service';

@Module({
  controllers: [RewardController, AdminRewardController],
  providers: [RewardService, SettlementPayloadService],
  exports: [RewardService, SettlementPayloadService],
})
export class RewardModule {}