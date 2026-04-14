import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BattleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BattleService } from './battle.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class BattleSweeper implements OnModuleInit {
  private readonly log = new Logger(BattleSweeper.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly battle: BattleService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit() {
    // tick each 1s
    setInterval(() => this.tick().catch(e => this.log.error(e)), 1000);
  }

  private async tick() {
    const now = Date.now();

    // find started battles
    const battles = await this.prisma.battle.findMany({
      where: { status: BattleStatus.STARTED },
      take: 50,
    });

    for (const b of battles) {
      const started = b.startedAt?.getTime() ?? 0;
      if (!started) continue;

      const elapsed = Math.floor((now - started) / 1000);
      const timeLeft = b.timeLimitSec - elapsed;

      // finish if timeout
      if (timeLeft <= 0) {
        await this.battle.finishBattle(b.id, 'TIMEOUT');
        continue;
      }

      // finish if all answered flag
      const flag = await this.redis.client.get(`battle:${b.id}:all_answered`);
      if (flag === '1') {
        await this.redis.client.del(`battle:${b.id}:all_answered`);
        await this.battle.finishBattle(b.id, 'ALL_ANSWERED');
        continue;
      }
    }
  }
}
