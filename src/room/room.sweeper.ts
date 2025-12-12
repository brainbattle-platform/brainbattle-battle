import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RoomStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BattleGateway } from '../ws/battle.gateway';

@Injectable()
export class RoomSweeper implements OnModuleInit {
  private readonly log = new Logger(RoomSweeper.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ws: BattleGateway,
  ) {}

  onModuleInit() {
    setInterval(() => this.sweep().catch(e => this.log.error(e)), 1000);
  }

  private async sweep() {
    const now = new Date();

    const rooms = await this.prisma.battleRoom.findMany({
      where: {
        status: RoomStatus.WAITING,
        expiresAt: { lt: now },
      },
      include: { members: { where: { leftAt: null } } },
      take: 50,
    });

    for (const r of rooms) {
      await this.prisma.battleRoom.update({
        where: { id: r.id },
        data: {
          status: RoomStatus.FAILED,
          failReason: 'TIMEOUT',
          closedAt: new Date(),
        },
      });

      this.ws.emitRoomFailed(r.id, {
        roomId: r.id,
        reason: 'TIMEOUT',
      });
    }
  }
}
