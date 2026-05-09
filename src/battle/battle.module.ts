import { Module } from '@nestjs/common';
import { RoomModule } from '../room/room.module';
import { AdminBattleController } from './admin-battle.controller';
import { BattleController } from './battle.controller';
import { BattleService } from './battle.service';

@Module({
  imports: [RoomModule],
  controllers: [BattleController, AdminBattleController],
  providers: [BattleService],
  exports: [BattleService],
})
export class BattleModule {}