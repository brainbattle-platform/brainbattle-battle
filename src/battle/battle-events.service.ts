import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class BattleEventsService {
  private server?: Server;

  attachServer(server: Server) {
    this.server = server;
  }

  roomChannel(roomId: string) {
    return `room:${roomId}`;
  }

  battleChannel(battleId: string) {
    return `battle:${battleId}`;
  }

  userChannel(userId: string) {
    return `user:${userId}`;
  }

  emitToRoom(roomId: string, event: string, payload: unknown) {
    this.server?.to(this.roomChannel(roomId)).emit(event, payload);
  }

  emitToBattle(battleId: string, event: string, payload: unknown) {
    this.server?.to(this.battleChannel(battleId)).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(this.userChannel(userId)).emit(event, payload);
  }

  emitToUsers(userIds: string[], event: string, payload: unknown) {
    for (const userId of userIds) {
      this.emitToUser(userId, event, payload);
    }
  }
}