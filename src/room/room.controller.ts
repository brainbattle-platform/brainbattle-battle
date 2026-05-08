import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChangeSlotDto, CreateRoomDto, JoinRoomDto, SetReadyDto } from './dto';
import { RoomService } from './room.service';

@ApiTags('rooms')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @ApiOperation({
    summary: 'Create custom battle room',
    description:
      'DUEL_1V1: host is assigned to team A. TEAM_3V3: host must choose team and role.',
  })
  createRoom(@CurrentUser() user: AuthUser, @Body() dto: CreateRoomDto) {
    return this.roomService.createRoom(user.id, dto);
  }

  @Post('join')
  @ApiOperation({
    summary: 'Join room by room code',
    description:
      'DUEL_1V1: service auto assigns empty team. TEAM_3V3: player must choose team and role.',
  })
  joinRoom(@CurrentUser() user: AuthUser, @Body() dto: JoinRoomDto) {
    return this.roomService.joinByCode(user.id, dto);
  }

  @Get('me/active')
  @ApiOperation({ summary: 'Get my active room if exists' })
  getMyActiveRoom(@CurrentUser() user: AuthUser) {
    return this.roomService.getMyActiveRoom(user.id);
  }

  @Get('code/:roomCode')
  @ApiOperation({ summary: 'Get room state by room code' })
  @ApiParam({ name: 'roomCode' })
  getRoomByCode(@Param('roomCode') roomCode: string) {
    return this.roomService.getRoomByCode(roomCode);
  }

  @Get(':roomId')
  @ApiOperation({ summary: 'Get room state' })
  @ApiParam({ name: 'roomId' })
  getRoom(@Param('roomId') roomId: string) {
    return this.roomService.getRoom(roomId);
  }

  @Patch(':roomId/slot')
  @ApiOperation({
    summary: 'Change 3v3 team/role slot',
    description:
      'Only available before battle starts. Changing slot resets readiness.',
  })
  changeSlot(
    @CurrentUser() user: AuthUser,
    @Param('roomId') roomId: string,
    @Body() dto: ChangeSlotDto,
  ) {
    return this.roomService.changeSlot(user.id, roomId, dto);
  }

  @Patch(':roomId/ready')
  @ApiOperation({
    summary: 'Set ready/unready',
    description:
      'When all required players are present and ready, room status becomes READY.',
  })
  setReady(
    @CurrentUser() user: AuthUser,
    @Param('roomId') roomId: string,
    @Body() dto: SetReadyDto,
  ) {
    return this.roomService.setReady(user.id, roomId, dto.isReady);
  }

  @Post(':roomId/start-check')
  @ApiOperation({
    summary: 'Check if room can start battle',
    description:
      'Does not create battle yet. Used by frontend before moving to BattleModule flow.',
  })
  startCheck(@CurrentUser() user: AuthUser, @Param('roomId') roomId: string) {
    return this.roomService.startCheck(user.id, roomId);
  }

  @Post(':roomId/leave')
  @ApiOperation({
    summary: 'Leave room',
    description:
      'If host leaves, room is cancelled. Non-host leave returns room to WAITING.',
  })
  leaveRoom(@CurrentUser() user: AuthUser, @Param('roomId') roomId: string) {
    return this.roomService.leaveRoom(user.id, roomId);
  }

  @Post(':roomId/cancel')
  @ApiOperation({
    summary: 'Cancel room',
    description: 'Only host can cancel room before battle starts.',
  })
  cancelRoom(@CurrentUser() user: AuthUser, @Param('roomId') roomId: string) {
    return this.roomService.cancelRoom(user.id, roomId);
  }
}