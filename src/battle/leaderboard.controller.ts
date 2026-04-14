import { Controller, Get, HttpCode, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardQueryDto } from './dto';

@ApiTags('leaderboard')
@Controller('/api/battle/leaderboard')
export class LeaderboardController {
  constructor(private readonly lb: LeaderboardService) {}

  @Get()
  @HttpCode(201)
  list(@Query() q: LeaderboardQueryDto) {
    return this.lb.getLeaderboard(q);
  }
}
