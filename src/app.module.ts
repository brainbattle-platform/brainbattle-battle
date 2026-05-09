import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BattleModule } from './battle/battle.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { QuestionModule } from './question/question.module';
import { RedisModule } from './redis/redis.module';
import { RoomModule } from './room/room.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
    HealthModule,
    RoomModule,
    QuestionModule,
    BattleModule,
  ],
})
export class AppModule {}