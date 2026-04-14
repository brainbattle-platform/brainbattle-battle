import { Controller, Get, HttpCode, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RankService } from './rank.service';
import { MeDto } from './dto';

@ApiTags('rank')
@Controller('/api/battle/rank')
export class RankController {
  constructor(private readonly rank: RankService) {}

  @Get('/me')
  @HttpCode(201)
  me(@Query() q: MeDto) {
    return this.rank.getProfile(q.userId);
  }

  @Get('/me/history')
  @HttpCode(201)
  history(@Query() q: MeDto) {
    return this.rank.getHistory(q.userId);
  }
}
