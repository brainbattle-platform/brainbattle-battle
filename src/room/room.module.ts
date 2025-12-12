import { Module } from '@nestjs/common';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';
import { RoomSweeper } from './room.sweeper';
import { WsModule } from '../ws/ws.module';

@Module({
  imports: [
    WsModule, 
  ],
  controllers: [RoomController],
  providers: [RoomService, RoomSweeper],
})
export class RoomModule {}
