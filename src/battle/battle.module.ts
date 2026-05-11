import { Module } from '@nestjs/common';
import { RankModule } from '../rank/rank.module';
import { RewardModule } from '../reward/reward.module';
import { RoomModule } from '../room/room.module';
import { AdminBattleController } from './admin-battle.controller';
import { BattleController } from './battle.controller';
import { BattleService } from './battle.service';

@Module({
  imports: [RoomModule, RankModule, RewardModule],
  controllers: [BattleController, AdminBattleController],
  providers: [BattleService],
  exports: [BattleService],
})
export class BattleModule {}