import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
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
import { AdminListRoomsDto } from './dto';
import { RoomService } from './room.service';

@ApiTags('admin/rooms')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('admin/rooms')
export class AdminRoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get()
  @ApiOperation({
    summary: 'Admin list rooms',
    description: 'Filter rooms by status, format, code, or userId.',
  })
  listRooms(@CurrentUser() user: AuthUser, @Query() query: AdminListRoomsDto) {
    this.assertAdmin(user);
    return this.roomService.adminListRooms(query);
  }

  @Get(':roomId')
  @ApiOperation({ summary: 'Admin get room detail' })
  @ApiParam({ name: 'roomId' })
  getRoomDetail(@CurrentUser() user: AuthUser, @Param('roomId') roomId: string) {
    this.assertAdmin(user);
    return this.roomService.adminGetRoomDetail(roomId);
  }

  @Post(':roomId/force-cancel')
  @ApiOperation({
    summary: 'Admin force cancel room',
    description: 'Use this when a room is stuck in WAITING/READY/PLAYING.',
  })
  forceCancel(@CurrentUser() user: AuthUser, @Param('roomId') roomId: string) {
    this.assertAdmin(user);
    return this.roomService.adminForceCancelRoom(user.id, roomId);
  }

  private assertAdmin(user: AuthUser) {
    const roles = user.roles ?? [];
    const isAdmin = roles.includes('admin') || roles.includes('ADMIN');

    if (!isAdmin) {
      throw new ForbiddenException('Admin role required');
    }
  }
}