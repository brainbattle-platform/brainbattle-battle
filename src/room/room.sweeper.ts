import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RoomStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BattleGateway } from '../ws/battle.gateway';

@Injectable()
export class RoomSweeper implements OnModuleInit {
  private readonly log = new Logger(RoomSweeper.name);

  constructor(private readonly prisma: PrismaService, private readonly ws: BattleGateway) {}

  onModuleInit() {
    setInterval(() => this.sweep().catch(e => this.log.error(e)), 1000);
  }

  private async sweep() {
    const now = new Date();
    const rooms = await this.prisma.battleRoom.findMany({
      where: { status: RoomStatus.WAITING, expiresAt: { lt: now } },
      take: 50,
    });

    for (const r of rooms) {
      await this.prisma.battleRoom.update({
        where: { id: r.id },
        data: { status: RoomStatus.FAILED, failReason: 'TIMEOUT', closedAt: new Date() },
      });

      this.ws.emitRoomFailed(r.id, { roomId: r.id, reason: 'TIMEOUT' });
      this.ws.emitRoomUpdated(r.id, await this.buildState(r.id));
    }
  }

  private async buildState(roomId: string) {
    const room = await this.prisma.battleRoom.findUnique({
      where: { id: roomId },
      include: { members: { where: { leftAt: null } } },
    });
    if (!room) return { roomId, status: 'failed' };

    return {
      roomId: room.id,
      roomCode: room.roomCode,
      mode: room.mode === 'ONE_VS_ONE' ? '1v1' : '3v3',
      status: room.status.toLowerCase(),
      expiresAt: room.expiresAt.toISOString(),
      members: room.members.map(m => ({
        userId: m.userId,
        team: m.team,
        role: m.role ? m.role.toLowerCase() : null,
        ready: m.isReady,
      })),
    };
  }
}
