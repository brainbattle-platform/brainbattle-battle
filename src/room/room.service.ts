import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Mode,
  RoomStatus,
  Role,
  Level,
  BattleType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { acquireLock, releaseLock } from '../redis/lock';
import { env } from '../common/env';
import { BattleGateway } from '../ws/battle.gateway';
import {
  CreateRoomDto,
  ModeDto,
  PickRoleDto,
  RoleDto,
  RoomStateResponse,
  BattleTypeDto,
  LevelDto,
} from './dto';
import { randomUUID } from 'crypto';

/* ======================
   Helpers
====================== */

function genRoomCode(len: number) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function mapMode(mode: ModeDto): Mode {
  return mode === ModeDto.ONE_VS_ONE
    ? Mode.ONE_VS_ONE
    : Mode.THREE_VS_THREE;
}

function mapBattleType(type: BattleTypeDto): BattleType {
  return {
    [BattleTypeDto.LISTENING]: BattleType.LISTENING,
    [BattleTypeDto.READING]: BattleType.READING,
    [BattleTypeDto.WRITING]: BattleType.WRITING,
    [BattleTypeDto.MIXED]: BattleType.MIXED,
  }[type];
}

function mapLevel(level: LevelDto): Level {
  return {
    [LevelDto.BASIC]: Level.BASIC,
    [LevelDto.MEDIUM]: Level.MEDIUM,
    [LevelDto.HIGH]: Level.HIGH,
  }[level];
}

function mapRole(role: RoleDto): Role {
  return {
    listening: Role.LISTENING,
    reading: Role.READING,
    writing: Role.WRITING,
  }[role];
}

@Injectable()
export class RoomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gateway: BattleGateway,
  ) {}

  /* ---------- CREATE ROOM ---------- */

  async createRoom(hostUserId: string, dto: CreateRoomDto) {
    const mode = mapMode(dto.mode);

    const expiresAt =
      mode === Mode.THREE_VS_THREE
        ? new Date(Date.now() + env.ROOM_3V3_TIMEOUT_SEC * 1000)
        : new Date(Date.now() + 5 * 60 * 1000);

    const room = await this.prisma.battleRoom.create({
      data: {
        roomCode: genRoomCode(env.ROOM_CODE_LEN),
        mode,
        battleType: mapBattleType(dto.battleType),
        level: mapLevel(dto.level),
        isRanked: dto.isRanked,
        status: RoomStatus.WAITING,
        hostUserId,
        expiresAt,
      },
    });

    await this.prisma.roomMember.create({
      data: {
        roomId: room.id,
        userId: hostUserId,
        team: 'A',
        role: null,
        isReady: false,
      },
    });

    await this.syncRoom(room.id);

    return {
      roomId: room.id,
      roomCode: room.roomCode,
      status: 'waiting',
      expiresAt: room.expiresAt.toISOString(),
    };
  }

  /* ---------- JOIN ROOM ---------- */

  async joinByCode(userId: string, roomCode: string) {
    const room = await this.prisma.battleRoom.findUnique({
      where: { roomCode },
      include: { members: { where: { leftAt: null } } },
    });

    if (!room) throw new NotFoundException('ROOM_NOT_FOUND');
    if (room.status !== RoomStatus.WAITING)
      throw new ConflictException('ROOM_NOT_JOINABLE');
    if (room.expiresAt.getTime() < Date.now())
      throw new GoneException('ROOM_EXPIRED');

    const max = room.mode === Mode.THREE_VS_THREE ? 6 : 2;
    if (room.members.length >= max)
      throw new ConflictException('ROOM_FULL');

    let team: 'A' | 'B' = 'A';
    if (room.mode === Mode.THREE_VS_THREE) {
      const a = room.members.filter(m => m.team === 'A').length;
      const b = room.members.filter(m => m.team === 'B').length;
      team = a <= b ? 'A' : 'B';
    } else {
      team = room.members.length === 0 ? 'A' : 'B';
    }

    await this.prisma.roomMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId } },
      update: { leftAt: null, team, role: null, isReady: false },
      create: { roomId: room.id, userId, team, role: null, isReady: false },
    });

    await this.syncRoom(room.id);

    return {
      roomId: room.id,
      status: 'waiting',
      expiresAt: room.expiresAt.toISOString(),
    };
  }

  /* ---------- STATE ---------- */

  async getRoomState(roomId: string): Promise<RoomStateResponse> {
    const room = await this.prisma.battleRoom.findUnique({
      where: { id: roomId },
      include: { members: { where: { leftAt: null } } },
    });

    if (!room) throw new NotFoundException('ROOM_NOT_FOUND');

    return {
      roomId: room.id,
      mode: room.mode === Mode.ONE_VS_ONE ? '1v1' : '3v3',
      status: room.status.toLowerCase(),
      expiresAt: room.expiresAt.toISOString(),
      members: room.members.map(m => ({
        userId: m.userId,
        team: m.team as 'A' | 'B',
        role: m.role ? m.role.toLowerCase() : null,
        ready: m.isReady,
      })),
    };
  }

  /* ---------- PICK ROLE ---------- */

  async pickRole(userId: string, roomId: string, dto: PickRoleDto) {
    const lock = await acquireLock(
      this.redis.client,
      `lock:room:${roomId}:pick`,
      3000,
    );
    if (!lock) throw new ConflictException('LOCKED_TRY_AGAIN');

    try {
      const member = await this.prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId, userId } },
      });
      if (!member) throw new ForbiddenException('NOT_IN_ROOM');

      const role = mapRole(dto.role);

      const taken = await this.prisma.roomMember.findFirst({
        where: { roomId, team: dto.team, role, leftAt: null },
      });
      if (taken && taken.userId !== userId)
        throw new ConflictException('ROLE_TAKEN');

      await this.prisma.roomMember.update({
        where: { roomId_userId: { roomId, userId } },
        data: { role, isReady: false },
      });

      await this.syncRoom(roomId);
      return { ok: true };
    } finally {
      await releaseLock(this.redis.client, lock);
    }
  }

  /* ---------- READY ---------- */

  async setReady(userId: string, roomId: string, ready: boolean) {
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!member) throw new ForbiddenException('NOT_IN_ROOM');
    if (ready && !member.role)
      throw new BadRequestException('ROLE_REQUIRED');

    await this.prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { isReady: ready },
    });

    await this.syncRoom(roomId);
    return { ok: true };
  }

  /* ---------- START ---------- */

  async startRoom(userId: string, roomId: string) {
    const lock = await acquireLock(
      this.redis.client,
      `lock:room:${roomId}:start`,
      5000,
    );
    if (!lock) throw new ConflictException('LOCKED_TRY_AGAIN');

    try {
      const room = await this.prisma.battleRoom.findUnique({
        where: { id: roomId },
        include: { members: { where: { leftAt: null } } },
      });

      if (!room) throw new NotFoundException('ROOM_NOT_FOUND');
      if (room.hostUserId !== userId)
        throw new ForbiddenException('NOT_HOST');
      if (room.status !== RoomStatus.WAITING)
        throw new ConflictException('ROOM_NOT_WAITING');

      const max = room.mode === Mode.THREE_VS_THREE ? 6 : 2;
      if (room.members.length !== max)
        throw new BadRequestException('NOT_ENOUGH_PLAYERS');
      if (room.members.some(m => !m.isReady))
        throw new BadRequestException('NOT_READY');

      const battleId = randomUUID();

      await this.prisma.battleRoom.update({
        where: { id: roomId },
        data: { status: RoomStatus.PLAYING, startedAt: new Date() },
      });

      await this.syncRoom(roomId);
      return { battleId, status: 'playing' };
    } finally {
      await releaseLock(this.redis.client, lock);
    }
  }

  /* ---------- SYNC ---------- */

  private async syncRoom(roomId: string) {
    const state = await this.getRoomState(roomId);
    await this.redis.client.set(
      `room:${roomId}`,
      JSON.stringify(state),
      'PX',
      120_000,
    );
    this.gateway.emitRoomUpdated(roomId, state);
  }
}
