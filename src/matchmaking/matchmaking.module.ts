import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { MatchmakingController } from './matchmaking.controller';
import { MatchmakingEventsService } from './matchmaking-events.service';
import { MatchmakingGateway } from './matchmaking.gateway';
import { MatchmakingService } from './matchmaking.service';

@Module({
  imports: [UserModule],
  controllers: [MatchmakingController],
  providers: [
    MatchmakingService,
    MatchmakingGateway,
    MatchmakingEventsService,
  ],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}