import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BattleModule } from './battle/battle.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { QuestionModule } from './question/question.module';
import { RankModule } from './rank/rank.module';
import { RedisModule } from './redis/redis.module';
import { RewardModule } from './reward/reward.module';
import { RoomModule } from './room/room.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
    HealthModule,
    RoomModule,
    QuestionModule,
    RewardModule,
    RankModule,
    BlockchainModule,
    BattleModule,
  ],
})
export class AppModule {}