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
import { JoinMatchmakingDto } from './dto';
import { MatchmakingEventsService } from './matchmaking-events.service';
import { MatchmakingService } from './matchmaking.service';

@WebSocketGateway({
  namespace: '/matchmaking',
  cors: {
    origin: env.SOCKET_CORS_ORIGIN === '*' ? true : env.SOCKET_CORS_ORIGIN,
    credentials: true,
  },
})
export class MatchmakingGateway implements OnGatewayInit {
  private readonly logger = new Logger(MatchmakingGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly matchmakingService: MatchmakingService,
    private readonly events: MatchmakingEventsService,
  ) {}

  afterInit(server: Server) {
    this.events.attachServer(server);
    this.logger.log('Matchmaking gateway initialized');
  }

  @UseGuards(AuthGuard)
  @SubscribeMessage('matchmaking.status')
  async getStatus(@ConnectedSocket() client: Socket) {
    const user = client.data.user as AuthUser;
    await client.join(this.events.userRoom(user.id));

    const payload = await this.matchmakingService.getMyQueueStatus(user.id);

    client.emit('queue.status', payload);

    return payload;
  }

  @UseGuards(AuthGuard)
  @SubscribeMessage('matchmaking.join')
  async joinQueue(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinMatchmakingDto,
  ) {
    const user = client.data.user as AuthUser;
    await client.join(this.events.userRoom(user.id));

    const payload = await this.matchmakingService.joinQueue(user.id, dto);

    client.emit('queue.joined', payload);

    return payload;
  }

  @UseGuards(AuthGuard)
  @SubscribeMessage('matchmaking.leave')
  async leaveQueue(@ConnectedSocket() client: Socket) {
    const user = client.data.user as AuthUser;
    await client.join(this.events.userRoom(user.id));

    const payload = await this.matchmakingService.leaveQueue(user.id);

    client.emit('queue.left', payload);

    return payload;
  }
}