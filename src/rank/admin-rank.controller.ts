import {
  Controller,
  ForbiddenException,
  Get,
  Param,
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
import { RankService } from './rank.service';

@ApiTags('admin/rank')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('admin/rank')
export class AdminRankController {
  constructor(private readonly rankService: RankService) {}

  @Get(':userId')
  @ApiOperation({ summary: 'Admin get player rank profile' })
  @ApiParam({ name: 'userId' })
  getPlayerRank(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
  ) {
    this.assertAdmin(user);
    return this.rankService.adminGetPlayerRank(userId);
  }

  @Get(':userId/logs')
  @ApiOperation({ summary: 'Admin get player rank change logs' })
  @ApiParam({ name: 'userId' })
  getPlayerRankLogs(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
  ) {
    this.assertAdmin(user);
    return this.rankService.adminGetPlayerRankLogs(userId);
  }

  private assertAdmin(user: AuthUser) {
    const roles = user.roles ?? [];
    if (!roles.includes('admin') && !roles.includes('ADMIN')) {
      throw new ForbiddenException('Admin role required');
    }
  }
}