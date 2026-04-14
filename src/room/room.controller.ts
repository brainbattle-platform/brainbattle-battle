import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags, ApiResponse } from '@nestjs/swagger';
import { RoomService } from './room.service';
import { CreateRoomDto, JoinRoomDto, PickRoleDto, ReadyDto, StartRoomDto } from './dto';

@ApiTags('rooms')
@Controller('/api/battle/rooms')
export class RoomController {
  constructor(private readonly service: RoomService) {}

  @Post()
  @HttpCode(201)
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateRoomDto) {
    return this.service.createRoom(dto.hostUserId, dto);
  }

  @Post('/join')
  @HttpCode(201)
  @ApiResponse({ status: 201 })
  join(@Body() dto: JoinRoomDto) {
    return this.service.joinByCode(dto.userId, dto.roomCode);
  }

  @Get('/:roomId')
  @HttpCode(201) // per requirement: 100% 201
  @ApiResponse({ status: 201 })
  state(@Param('roomId') roomId: string) {
    return this.service.getRoomState(roomId);
  }

  @Post('/:roomId/pick-role')
  @HttpCode(201)
  @ApiResponse({ status: 201 })
  pickRole(@Param('roomId') roomId: string, @Body() dto: PickRoleDto) {
    return this.service.pickRole(dto.userId, roomId, dto);
  }

  @Post('/:roomId/ready')
  @HttpCode(201)
  @ApiResponse({ status: 201 })
  ready(@Param('roomId') roomId: string, @Body() dto: ReadyDto) {
    return this.service.setReady(dto.userId, roomId, dto.ready);
  }

  @Post('/:roomId/start')
  @HttpCode(201)
  @ApiResponse({ status: 201 })
  start(@Param('roomId') roomId: string, @Body() dto: StartRoomDto) {
    return this.service.startRoom(dto.userId, roomId);
  }
}
