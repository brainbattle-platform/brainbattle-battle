import { Module } from '@nestjs/common';
import { BattleGateway } from './battle.gateway';

@Module({
  providers: [BattleGateway],
  exports: [BattleGateway], 
})
export class WsModule {}
