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
import { AdminListBattlesDto } from './dto';
import { BattleService } from './battle.service';

@ApiTags('admin/battles')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('admin/battles')
export class AdminBattleController {
  constructor(private readonly battleService: BattleService) { }

  @Get()
  @ApiOperation({
    summary: 'Admin list battles',
    description: 'Filter battles by status, format, roomId, or userId.',
  })
  listBattles(
    @CurrentUser() user: AuthUser,
    @Query() query: AdminListBattlesDto,
  ) {
    this.assertAdmin(user);
    return this.battleService.adminListBattles(query);
  }

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

  @Get(':battleId/settlement')
  @ApiOperation({ summary: 'Admin get battle rank/reward settlement' })
  @ApiParam({ name: 'battleId' })
  getSettlement(
    @CurrentUser() user: AuthUser,
    @Param('battleId') battleId: string,
  ) {
    this.assertAdmin(user);
    return this.battleService.adminGetSettlement(battleId);
  }
}