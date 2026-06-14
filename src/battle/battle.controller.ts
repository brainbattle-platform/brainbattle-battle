import {
  Body,
  Controller,
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
import { BattleService } from './battle.service';
import {
  CreateBattleFromRoomDto,
  ListMyBattleHistoryDto,
  StartBattleFromRoomDto,
  SubmitAnswerDto,
} from './dto';

@ApiTags('battles')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('battles')
export class BattleController {
  constructor(private readonly battleService: BattleService) { }



  @Get('me/active')
  @ApiOperation({
    summary: 'Get current player active battle',
    description:
      'Returns CREATED/RUNNING battle for current player if there is one. Used by mobile to resume real gameplay state.',
  })
  getMyActiveBattle(@CurrentUser() user: AuthUser) {
    return this.battleService.getMyActiveBattle(user.id);
  }

  @Get('me/history')
  @ApiOperation({ summary: 'Get current player battle history' })
  getMyHistory(
    @CurrentUser() user: AuthUser,
    @Query() query: ListMyBattleHistoryDto,
  ) {
    return this.battleService.getMyHistory(user.id, query);
  }

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

  @Post('from-room/:roomId/start')
  @ApiOperation({
    summary: 'Create and start battle from READY room',
    description:
      'Host only. Creates battle session from a READY room and starts it immediately by default.',
  })
  @ApiParam({ name: 'roomId' })
  startFromRoom(
    @CurrentUser() user: AuthUser,
    @Param('roomId') roomId: string,
    @Body() dto: StartBattleFromRoomDto,
  ) {
    return this.battleService.startFromRoom(user.id, roomId, dto);
  }

  @Get(':battleId')
  @ApiOperation({ summary: 'Get battle state' })
  @ApiParam({ name: 'battleId' })
  getBattle(@Param('battleId') battleId: string) {
    return this.battleService.getBattle(battleId);
  }

  @Get(':battleId/summary')
  @ApiOperation({
    summary: 'Get battle summary for participant',
    description:
      'Participant-only review endpoint. Returns scoreboard, questions, and submissions after battle.',
  })
  @ApiParam({ name: 'battleId' })
  getSummary(
    @CurrentUser() user: AuthUser,
    @Param('battleId') battleId: string,
  ) {
    return this.battleService.getBattleSummary(user.id, battleId);
  }

  @Get(':battleId/public-result')
  @ApiOperation({
    summary: 'Get public battle result',
    description:
      'Sanitized result endpoint. Returns result/scoreboard without correct answers.',
  })
  @ApiParam({ name: 'battleId' })
  getPublicResult(@Param('battleId') battleId: string) {
    return this.battleService.getPublicResult(battleId);
  }

  @Get(':battleId/result')
  @ApiOperation({ summary: 'Get battle result' })
  @ApiParam({ name: 'battleId' })
  getResult(@Param('battleId') battleId: string) {
    return this.battleService.getResult(battleId);
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

  @Get(':battleId/current-question')
  @ApiOperation({
    summary: 'Get current active question for current player',
    description:
      'Server-authoritative question endpoint. Returns one active question with server timer.',
  })
  @ApiParam({ name: 'battleId' })
  getCurrentQuestion(
    @CurrentUser() user: AuthUser,
    @Param('battleId') battleId: string,
  ) {
    return this.battleService.getCurrentQuestion(user.id, battleId);
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

  @Post(':battleId/finish')
  @ApiOperation({ summary: 'Finish battle and calculate result' })
  @ApiParam({ name: 'battleId' })
  finishBattle(
    @CurrentUser() user: AuthUser,
    @Param('battleId') battleId: string,
  ) {
    return this.battleService.finishBattle(user.id, battleId);
  }
}