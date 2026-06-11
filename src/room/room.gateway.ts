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
import { SetReadyDto } from './dto';
import { RoomEventsService } from './room-events.service';
import { RoomService } from './room.service';

type JoinRoomSocketDto = {
  roomId: string;
};

type ReadySocketDto = {
  roomId: string;
  isReady: boolean;
};

@WebSocketGateway({
  namespace: '/rooms',
  cors: {
    origin: env.SOCKET_CORS_ORIGIN === '*' ? true : env.SOCKET_CORS_ORIGIN,
    credentials: true,
  },
})
export class RoomGateway implements OnGatewayInit {
  private readonly logger = new Logger(RoomGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly roomService: RoomService,
    private readonly events: RoomEventsService,
  ) {}

  afterInit(server: Server) {
    this.events.attachServer(server);
    this.logger.log('Room gateway initialized');
  }

  @UseGuards(AuthGuard)
  @SubscribeMessage('room.join')
  async joinRoomChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinRoomSocketDto,
  ) {
    const user = client.data.user as AuthUser;

    await client.join(this.events.userChannel(user.id));
    await client.join(this.events.roomChannel(dto.roomId));

    const room = await this.roomService.getRoom(dto.roomId);

    client.emit('room.state', room);

    return room;
  }

  @UseGuards(AuthGuard)
  @SubscribeMessage('room.status')
  async getRoomStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinRoomSocketDto,
  ) {
    const user = client.data.user as AuthUser;

    await client.join(this.events.userChannel(user.id));
    await client.join(this.events.roomChannel(dto.roomId));

    const room = await this.roomService.getRoom(dto.roomId);

    client.emit('room.state', room);

    return room;
  }

  @UseGuards(AuthGuard)
  @SubscribeMessage('room.ready')
  async setReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: ReadySocketDto,
  ) {
    const user = client.data.user as AuthUser;

    await client.join(this.events.userChannel(user.id));
    await client.join(this.events.roomChannel(dto.roomId));

    const readyDto: SetReadyDto = {
      isReady: dto.isReady,
    };

    const room = await this.roomService.setReady(
      user.id,
      dto.roomId,
      readyDto.isReady,
    );

    return room;
  }

  @UseGuards(AuthGuard)
  @SubscribeMessage('room.leave')
  async leaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinRoomSocketDto,
  ) {
    const user = client.data.user as AuthUser;
    const room = await this.roomService.leaveRoom(user.id, dto.roomId);

    await client.leave(this.events.roomChannel(dto.roomId));

    return room;
  }
}