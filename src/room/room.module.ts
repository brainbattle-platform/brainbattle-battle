import { Module } from '@nestjs/common';
import { AdminRoomController } from './admin-room.controller';
import { RoomController } from './room.controller';
import { RoomEventsService } from './room-events.service';
import { RoomGateway } from './room.gateway';
import { RoomService } from './room.service';

@Module({
  controllers: [RoomController, AdminRoomController],
  providers: [RoomService, RoomGateway, RoomEventsService],
  exports: [RoomService, RoomEventsService],
})
export class RoomModule {}