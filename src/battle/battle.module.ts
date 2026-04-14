import { Module } from '@nestjs/common';
import { WsModule } from '../ws/ws.module';
import { BattleController } from './battle.controller';
import { RankController } from './rank.controller';
import { LeaderboardController } from './leaderboard.controller';
import { BattleService } from './battle.service';
import { BattleRuntimeService } from './battle.runtime.service';
import { RankService } from './rank.service';
import { LeaderboardService } from './leaderboard.service';
import { BattleSweeper } from './battle.sweeper';
import { QuestionBankService } from './question-bank.service';

@Module({
  imports: [WsModule],
  controllers: [BattleController, RankController, LeaderboardController],
  providers: [BattleService, BattleRuntimeService, RankService, LeaderboardService, BattleSweeper, QuestionBankService],
})
export class BattleModule {}
