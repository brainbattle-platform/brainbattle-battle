import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { RankService } from './rank.service';

@ApiTags('rank')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('rank')
export class RankController {
  constructor(private readonly rankService: RankService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current player rank profile' })
  getMe(@CurrentUser() user: AuthUser) {
    return this.rankService.getMyRank(user.id);
  }
}