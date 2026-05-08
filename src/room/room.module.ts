import { Module } from '@nestjs/common';
import { AdminRoomController } from './admin-room.controller';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';

@Module({
  controllers: [RoomController, AdminRoomController],
  providers: [RoomService],
  exports: [RoomService],
})
export class RoomModule {}