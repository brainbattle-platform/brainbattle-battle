import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: '/ws/battle', cors: { origin: '*' } })
export class BattleGateway {
  @WebSocketServer() server!: Server;

  @SubscribeMessage('join')
  handleJoin(client: Socket, @MessageBody() body: { roomId: string }) {
    if (!body?.roomId) return;
    client.join(`room:${body.roomId}`);
    client.emit('JOINED', { roomId: body.roomId });
  }

  @SubscribeMessage('joinBattle')
  handleJoinBattle(client: Socket, @MessageBody() body: { battleId: string }) {
    if (!body?.battleId) return;
    client.join(`battle:${body.battleId}`);
    client.emit('BATTLE_JOINED', { battleId: body.battleId });
  }

  emitRoomUpdated(roomId: string, payload: any) {
    this.server.to(`room:${roomId}`).emit('ROOM_UPDATED', payload);
  }

  emitRoomFailed(roomId: string, payload: any) {
    this.server.to(`room:${roomId}`).emit('ROOM_FAILED', payload);
  }

  emitBattleCreated(battleId: string, payload: any) {
    this.server.to(`battle:${battleId}`).emit('BATTLE_CREATED', payload);
  }

  emitBattleStarted(battleId: string, payload: any) {
    this.server.to(`battle:${battleId}`).emit('BATTLE_STARTED', payload);
  }

  emitBattleState(battleId: string, payload: any) {
    this.server.to(`battle:${battleId}`).emit('BATTLE_STATE', payload);
  }

  emitBattleFinished(battleId: string, payload: any) {
    this.server.to(`battle:${battleId}`).emit('BATTLE_FINISHED', payload);
  }

  emitRankUpdated(userId: string, payload: any) {
    this.server.emit('RANK_UPDATED', { userId, ...payload });
  }
}
