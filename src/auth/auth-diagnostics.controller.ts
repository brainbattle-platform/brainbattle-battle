import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthUser } from './auth.types';
import { UserWalletClient } from './user-wallet.client';
import { UserService } from '../user/user.service';

@ApiTags('Auth Bridge')
@Controller('auth-bridge')
export class AuthDiagnosticsController {
  constructor(
    private readonly userService: UserService,
    private readonly userWalletClient: UserWalletClient,
  ) {}

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Verify Supabase token through Auth Service and return Battle auth context',
  })
  getMe(@CurrentUser() user: AuthUser) {
    return {
      userId: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      roles: user.roles ?? [],
      profile: user.profile ?? null,
      learnerProfile: user.learnerProfile ?? null,
      wallets: (user.raw as any)?.wallets ?? [],
      wallet: ((user.raw as any)?.wallets ?? []).find((wallet: any) => wallet?.is_primary || wallet?.isPrimary) ?? null,
      walletAddress: (((user.raw as any)?.wallets ?? []).find((wallet: any) => wallet?.is_primary || wallet?.isPrimary)?.wallet_address) ?? null,
    };
  }

  @Get('public-profiles/:userId')
  @ApiOperation({
    summary: 'Test Battle Service reading public profile from Auth Service',
  })
  @ApiParam({ name: 'userId', type: String })
  getPublicProfile(@Param('userId') userId: string) {
    return this.userService.getPublicProfile(userId);
  }

  @Get('wallets/:userId')
  @ApiOperation({
    summary: 'Test Battle Service reading wallet from Auth Service',
  })
  @ApiParam({ name: 'userId', type: String })
  getWallet(@Param('userId') userId: string) {
    return this.userWalletClient.getWallet(userId);
  }
}