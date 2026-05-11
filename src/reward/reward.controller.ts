import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { RewardService } from './reward.service';

@ApiTags('rewards')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('rewards')
export class RewardController {
  constructor(private readonly rewardService: RewardService) {}

  @Get('me/wallet')
  @ApiOperation({ summary: 'Get current player reward wallet' })
  getMyWallet(@CurrentUser() user: AuthUser) {
    return this.rewardService.getMyWallet(user.id);
  }

  @Get('me/ledger')
  @ApiOperation({ summary: 'Get current player reward ledger' })
  getMyLedger(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.rewardService.getMyLedger(user.id, {
      page: Number(page ?? 1),
      limit: Number(limit ?? 20),
    });
  }
}