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
import { BlockchainService } from '../blockchain/blockchain.service';
import { SettlementPayloadService } from '../reward/settlement-payload.service';
import { AdminListBattlesDto } from './dto';
import { BattleService } from './battle.service';

@ApiTags('admin/battles')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('admin/battles')
export class AdminBattleController {
  constructor(
    private readonly battleService: BattleService,
    private readonly settlementPayloadService: SettlementPayloadService,
    private readonly blockchainService: BlockchainService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Admin list battles' })
  listBattles(
    @CurrentUser() user: AuthUser,
    @Query() query: AdminListBattlesDto,
  ) {
    this.assertAdmin(user);
    return this.battleService.adminListBattles(query);
  }

  @Get(':battleId')
  @ApiOperation({ summary: 'Admin get battle detail' })
  @ApiParam({ name: 'battleId' })
  getBattleDetail(
    @CurrentUser() user: AuthUser,
    @Param('battleId') battleId: string,
  ) {
    this.assertAdmin(user);
    return this.battleService.adminGetBattleDetail(battleId);
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

  @Get(':battleId/settlement-payload')
  @ApiOperation({ summary: 'Admin get blockchain-ready settlement payload' })
  @ApiParam({ name: 'battleId' })
  getSettlementPayload(
    @CurrentUser() user: AuthUser,
    @Param('battleId') battleId: string,
  ) {
    this.assertAdmin(user);
    return this.settlementPayloadService.buildBattleSettlementPayload(battleId);
  }

  @Post(':battleId/record-onchain')
  @ApiOperation({ summary: 'Admin record battle result on-chain' })
  @ApiParam({ name: 'battleId' })
  recordOnchain(
    @CurrentUser() user: AuthUser,
    @Param('battleId') battleId: string,
  ) {
    this.assertAdmin(user);
    return this.blockchainService.recordBattleOnchain(battleId);
  }

  @Get(':battleId/onchain-record')
  @ApiOperation({ summary: 'Admin get on-chain record' })
  @ApiParam({ name: 'battleId' })
  getOnchainRecord(
    @CurrentUser() user: AuthUser,
    @Param('battleId') battleId: string,
  ) {
    this.assertAdmin(user);
    return this.blockchainService.getOnchainRecord(battleId);
  }

  private assertAdmin(user: AuthUser) {
    const roles = user.roles ?? [];

    if (!roles.includes('admin') && !roles.includes('ADMIN')) {
      throw new ForbiddenException('Admin role required');
    }
  }
}