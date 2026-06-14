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
import { StartBattleFromRoomDto, SubmitAnswerDto } from './dto';

type JoinBattleSocketDto = {
  battleId: string;
};

type StartBattleRoomSocketDto = StartBattleFromRoomDto & {
  roomId: string;
};

type SubmitAnswerSocketDto = SubmitAnswerDto & {
  battleId: string;
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

    const snapshot = await this.battleService.getBattleRuntimeSnapshot(
      user.id,
      dto.battleId,
    );

    client.emit('battle.state', snapshot.battle);

    if (snapshot.currentQuestion) {
      client.emit('battle.question', snapshot.currentQuestion);
    }

    client.emit('battle.reconnected', snapshot);

    return snapshot;
  }

  @UseGuards(AuthGuard)
  @SubscribeMessage('battle.currentQuestion')
  async getCurrentQuestion(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinBattleSocketDto,
  ) {
    const user = client.data.user as AuthUser;

    await client.join(this.events.userChannel(user.id));
    await client.join(this.events.battleChannel(dto.battleId));

    const currentQuestion = await this.battleService.getCurrentQuestion(
      user.id,
      dto.battleId,
    );

    client.emit('battle.question', currentQuestion);

    return currentQuestion;
  }

  @UseGuards(AuthGuard)
  @SubscribeMessage('battle.answer.submit')
  async submitAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SubmitAnswerSocketDto,
  ) {
    const user = client.data.user as AuthUser;

    await client.join(this.events.userChannel(user.id));
    await client.join(this.events.battleChannel(dto.battleId));

    return this.battleService.submitAnswer(user.id, dto.battleId, {
      questionSnapshotId: dto.questionSnapshotId,
      selectedOptionKey: dto.selectedOptionKey,
      textAnswer: dto.textAnswer,
    });
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