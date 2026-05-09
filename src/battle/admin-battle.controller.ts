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
import { BattleService } from './battle.service';

@ApiTags('admin/battles')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('admin/battles')
export class AdminBattleController {
  constructor(private readonly battleService: BattleService) {}

  @Get(':battleId')
  @ApiOperation({
    summary: 'Admin get battle detail',
    description:
      'Debug endpoint. Returns full battle snapshots including correct answers.',
  })
  @ApiParam({ name: 'battleId' })
  getBattleDetail(
    @CurrentUser() user: AuthUser,
    @Param('battleId') battleId: string,
  ) {
    this.assertAdmin(user);
    return this.battleService.adminGetBattleDetail(battleId);
  }

  private assertAdmin(user: AuthUser) {
    const roles = user.roles ?? [];
    const isAdmin = roles.includes('admin') || roles.includes('ADMIN');

    if (!isAdmin) {
      throw new ForbiddenException('Admin role required');
    }
  }
}