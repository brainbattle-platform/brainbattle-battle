import { Logger, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.types';
import { env } from '../common/env';
import { BattleEventsService } from './battle-events.service';
import { BattleService } from './battle.service';
import { StartBattleFromRoomDto } from './dto';

type JoinBattleSocketDto = {
  battleId: string;
};

type StartBattleRoomSocketDto = StartBattleFromRoomDto & {
  roomId: string;
};

@WebSocketGateway({
  namespace: '/battles',
  cors: {
    origin: env.SOCKET_CORS_ORIGIN === '*' ? true : env.SOCKET_CORS_ORIGIN,
    credentials: true,
  },
})
export class BattleGateway implements OnGatewayInit {
  private readonly logger = new Logger(BattleGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly battleService: BattleService,
    private readonly events: BattleEventsService,
  ) {}

  afterInit(server: Server) {
    this.events.attachServer(server);
    this.logger.log('Battle gateway initialized');
  }

  @UseGuards(AuthGuard)
  @SubscribeMessage('battle.join')
  async joinBattle(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinBattleSocketDto,
  ) {
    const user = client.data.user as AuthUser;

    await client.join(this.events.userChannel(user.id));
    await client.join(this.events.battleChannel(dto.battleId));

    const battle = await this.battleService.getBattle(dto.battleId);

    client.emit('battle.state', battle);

    return battle;
  }

  @UseGuards(AuthGuard)
  @SubscribeMessage('battle.start.fromRoom')
  async startFromRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: StartBattleRoomSocketDto,
  ) {
    const user = client.data.user as AuthUser;

    await client.join(this.events.userChannel(user.id));

    const battle = await this.battleService.startFromRoom(user.id, dto.roomId, {
      questionCount: dto.questionCount,
      autoStart: dto.autoStart ?? true,
    });

    await client.join(this.events.battleChannel(battle.id));

    return battle;
  }
}