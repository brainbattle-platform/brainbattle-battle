import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RoomService } from './room.service';
import {
  CreateRoomDto,
  JoinRoomDto,
  PickRoleDto,
  ReadyDto,
  RoomStateResponse,
} from './dto';

@ApiTags('Battle Rooms')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard)
@Controller('/api/battle/rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @ApiOperation({ summary: 'Create battle room (1v1 / 3v3)' })
  create(@Req() req: any, @Body() dto: CreateRoomDto) {
    return this.roomService.createRoom(req.user.userId, dto);
  }

  @Post('/join')
  @ApiOperation({ summary: 'Join room by code' })
  join(@Req() req: any, @Body() dto: JoinRoomDto) {
    return this.roomService.joinByCode(req.user.userId, dto.roomCode);
  }

  @Get('/:roomId')
  @ApiOperation({ summary: 'Get room state' })
  get(@Param('roomId') roomId: string): Promise<RoomStateResponse> {
    return this.roomService.getRoomState(roomId);
  }

  @Post('/:roomId/pick-role')
  @ApiOperation({ summary: 'Pick role (3v3 only)' })
  pickRole(
    @Req() req: any,
    @Param('roomId') roomId: string,
    @Body() dto: PickRoleDto,
  ) {
    return this.roomService.pickRole(req.user.userId, roomId, dto);
  }

  @Post('/:roomId/ready')
  @ApiOperation({ summary: 'Set ready / unready' })
  ready(
    @Req() req: any,
    @Param('roomId') roomId: string,
    @Body() dto: ReadyDto,
  ) {
    return this.roomService.setReady(req.user.userId, roomId, dto.ready);
  }

  @Post('/:roomId/start')
  @ApiOperation({ summary: 'Start battle (host only)' })
  start(@Req() req: any, @Param('roomId') roomId: string) {
    return this.roomService.startRoom(req.user.userId, roomId);
  }
}
