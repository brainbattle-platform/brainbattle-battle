import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RoomModule } from './room/room.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
    HealthModule,
    RoomModule,
  ],
})
export class AppModule {}