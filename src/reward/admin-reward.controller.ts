import {
  Controller,
  ForbiddenException,
  Get,
  Param,
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
import { RewardService } from './reward.service';

@ApiTags('admin/rewards')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('admin/rewards')
export class AdminRewardController {
  constructor(private readonly rewardService: RewardService) {}

  @Get(':userId/wallet')
  @ApiOperation({ summary: 'Admin get player reward wallet' })
  @ApiParam({ name: 'userId' })
  getWallet(@CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    this.assertAdmin(user);
    return this.rewardService.adminGetWallet(userId);
  }

  @Get(':userId/ledger')
  @ApiOperation({ summary: 'Admin get player reward ledger' })
  @ApiParam({ name: 'userId' })
  getLedger(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.assertAdmin(user);
    return this.rewardService.adminGetLedger(userId, {
      page: Number(page ?? 1),
      limit: Number(limit ?? 20),
    });
  }

  private assertAdmin(user: AuthUser) {
    const roles = user.roles ?? [];
    if (!roles.includes('admin') && !roles.includes('ADMIN')) {
      throw new ForbiddenException('Admin role required');
    }
  }
}