import {
  Body,
  Controller,
  Get,
  Param,
  Post,
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
import { CreateBattleFromRoomDto } from './dto';

@ApiTags('battles')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('battles')
export class BattleController {
  constructor(private readonly battleService: BattleService) {}

  @Post('from-room/:roomId')
  @ApiOperation({
    summary: 'Create battle from READY room',
    description:
      'Host only. Snapshots approved questions and marks room as PLAYING.',
  })
  @ApiParam({ name: 'roomId' })
  createFromRoom(
    @CurrentUser() user: AuthUser,
    @Param('roomId') roomId: string,
    @Body() dto: CreateBattleFromRoomDto,
  ) {
    return this.battleService.createFromRoom(user.id, roomId, dto);
  }

  @Get(':battleId')
  @ApiOperation({ summary: 'Get battle state' })
  @ApiParam({ name: 'battleId' })
  getBattle(@Param('battleId') battleId: string) {
    return this.battleService.getBattle(battleId);
  }
}