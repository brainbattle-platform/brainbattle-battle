import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JoinMatchmakingDto } from './dto';
import { MatchmakingService } from './matchmaking.service';

@ApiTags('matchmaking')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('matchmaking')
export class MatchmakingController {
  constructor(private readonly matchmakingService: MatchmakingService) {}

  @Post('join')
  @ApiOperation({
    summary: 'Join matchmaking queue',
    description:
      'Supports DUEL_1V1 and TEAM_3V3 matchmaking with rank/role balancing.',
  })
  joinQueue(@CurrentUser() user: AuthUser, @Body() dto: JoinMatchmakingDto) {
    return this.matchmakingService.joinQueue(user.id, dto);
  }

  @Post('leave')
  @ApiOperation({
    summary: 'Leave current matchmaking queue',
  })
  leaveQueue(@CurrentUser() user: AuthUser) {
    return this.matchmakingService.leaveQueue(user.id);
  }

  @Get('me/status')
  @ApiOperation({
    summary: 'Get my current matchmaking queue status',
  })
  getMyQueueStatus(@CurrentUser() user: AuthUser) {
    return this.matchmakingService.getMyQueueStatus(user.id);
  }
}