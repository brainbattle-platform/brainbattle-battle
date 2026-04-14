import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BattleService } from './battle.service';
import { BattleRuntimeService } from './battle.runtime.service';
import { CreateFromRoomDto, FinishBattleDto, StartBattleDto, SubmitAnswerDto, MeDto } from './dto';

@ApiTags('battles')
@Controller('/api/battle/battles')
export class BattleController {
  constructor(
    private readonly battleService: BattleService,
    private readonly runtime: BattleRuntimeService,
  ) {}

  // Create battle from room
  @Post('/from-room/:roomId')
  @HttpCode(201)
  createFromRoom(@Param('roomId') roomId: string, @Body() dto: CreateFromRoomDto) {
    return this.battleService.createBattleFromRoom(roomId, dto.userId);
  }

  @Post('/:battleId/start')
  @HttpCode(201)
  start(@Param('battleId') battleId: string, @Body() dto: StartBattleDto) {
    return this.battleService.startBattle(battleId, dto.userId);
  }

  @Get('/:battleId/state')
  @HttpCode(201)
  state(@Param('battleId') battleId: string, @Query() q: MeDto) {
    return this.battleService.getBattleState(battleId, q.userId);
  }

  @Post('/:battleId/answers')
  @HttpCode(201)
  submit(@Param('battleId') battleId: string, @Body() dto: SubmitAnswerDto) {
    return this.runtime.submitAnswer(battleId, dto);
  }

  @Post('/:battleId/finish')
  @HttpCode(201)
  finish(@Param('battleId') battleId: string, @Body() dto: FinishBattleDto) {
    return this.battleService.finishBattle(battleId, dto.reason ?? 'FORCE');
  }

  @Get('/:battleId/result')
  @HttpCode(201)
  result(@Param('battleId') battleId: string) {
    return this.battleService.getBattleResult(battleId);
  }

  @Get('/history')
  @HttpCode(201)
  history(@Query() q: MeDto) {
    return this.battleService.getBattleHistory(q.userId);
  }

  @Get('/:battleId/detail')
  @HttpCode(201)
  detail(@Param('battleId') battleId: string, @Query() q: MeDto) {
    return this.battleService.getBattleDetailForUser(battleId, q.userId);
  }
}
