import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class MatchmakingEventsService {
  private server?: Server;

  attachServer(server: Server) {
    this.server = server;
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(this.userRoom(userId)).emit(event, payload);
  }

  emitToUsers(userIds: string[], event: string, payload: unknown) {
    for (const userId of userIds) {
      this.emitToUser(userId, event, payload);
    }
  }

  userRoom(userId: string) {
    return `user:${userId}`;
  }
}