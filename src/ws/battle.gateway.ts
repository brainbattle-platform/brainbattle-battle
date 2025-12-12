import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

@WebSocketGateway({
  namespace: '/ws/battle',
  cors: { origin: '*' },
})
export class BattleGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  afterInit(server: Server) {
    const pub = new Redis(process.env.REDIS_URL!);
    const sub = new Redis(process.env.REDIS_URL!);

    // ✅ ĐÚNG CHUẨN SOCKET.IO + NESTJS
    server.adapter(createAdapter(pub, sub));

    console.log('✅ Redis adapter attached to Socket.IO');
  }

  emitRoomUpdated(roomId: string, payload: any) {
    this.server.to(`room:${roomId}`).emit('ROOM_UPDATED', payload);
  }

  emitRoomFailed(roomId: string, payload: any) {
    this.server.to(`room:${roomId}`).emit('ROOM_FAILED', payload);
  }
}
