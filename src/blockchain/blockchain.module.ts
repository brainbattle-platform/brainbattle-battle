import { Module } from '@nestjs/common';
import { RewardModule } from '../reward/reward.module';
import { BlockchainService } from './blockchain.service';

@Module({
  imports: [RewardModule],
  providers: [BlockchainService],
  exports: [BlockchainService],
})
export class BlockchainModule {}