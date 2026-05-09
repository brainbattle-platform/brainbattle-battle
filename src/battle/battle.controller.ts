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
import {
  CreateBattleFromRoomDto,
  SubmitAnswerDto,
} from './dto';

@ApiTags('battles')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('battles')
export class BattleController {
  constructor(private readonly battleService: BattleService) { }

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

  @Post(':battleId/start')
  @ApiOperation({ summary: 'Start battle' })
  @ApiParam({ name: 'battleId' })
  startBattle(
    @CurrentUser() user: AuthUser,
    @Param('battleId') battleId: string,
  ) {
    return this.battleService.startBattle(user.id, battleId);
  }

  @Get(':battleId/questions')
  @ApiOperation({
    summary: 'Get public questions for current player',
    description:
      'For 1v1 returns shared questions. For 3v3 returns questions assigned to current player role.',
  })
  @ApiParam({ name: 'battleId' })
  getPublicQuestions(
    @CurrentUser() user: AuthUser,
    @Param('battleId') battleId: string,
  ) {
    return this.battleService.getPublicQuestions(user.id, battleId);
  }

  @Post(':battleId/answers')
  @ApiOperation({ summary: 'Submit answer' })
  @ApiParam({ name: 'battleId' })
  submitAnswer(
    @CurrentUser() user: AuthUser,
    @Param('battleId') battleId: string,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.battleService.submitAnswer(user.id, battleId, dto);
  }
}