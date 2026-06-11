import { Module } from '@nestjs/common';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { RankModule } from '../rank/rank.module';
import { RewardModule } from '../reward/reward.module';
import { RoomModule } from '../room/room.module';
import { AdminBattleController } from './admin-battle.controller';
import { BattleController } from './battle.controller';
import { BattleEventsService } from './battle-events.service';
import { BattleGateway } from './battle.gateway';
import { BattleService } from './battle.service';

@Module({
  imports: [RoomModule, RankModule, RewardModule, BlockchainModule],
  controllers: [BattleController, AdminBattleController],
  providers: [BattleService, BattleGateway, BattleEventsService],
  exports: [BattleService, BattleEventsService],
})
export class BattleModule {}