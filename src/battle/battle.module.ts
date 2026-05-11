import { Module } from '@nestjs/common';
import { RankModule } from '../rank/rank.module';
import { RoomModule } from '../room/room.module';
import { AdminBattleController } from './admin-battle.controller';
import { BattleController } from './battle.controller';
import { BattleService } from './battle.service';

@Module({
  imports: [RoomModule, RankModule],
  controllers: [BattleController, AdminBattleController],
  providers: [BattleService],
  exports: [BattleService],
})
export class BattleModule {}