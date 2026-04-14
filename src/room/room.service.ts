import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BattleType, Level, Mode, Role, RoomStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { acquireLock, releaseLock } from '../redis/lock';
import { BattleGateway } from '../ws/battle.gateway';
import { CreateRoomDto, ModeDto, BattleTypeDto, LevelDto, PickRoleDto, RoomStateResponse } from './dto';
import { randomUUID } from 'crypto';

function genRoomCode(len: number) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function mapMode(m: ModeDto): Mode {
  return m === ModeDto.ONE_VS_ONE ? Mode.ONE_VS_ONE : Mode.THREE_VS_THREE;
}
function mapBattleType(t: BattleTypeDto): BattleType {
  return {
    [BattleTypeDto.LISTENING]: BattleType.LISTENING,
    [BattleTypeDto.READING]: BattleType.READING,
    [BattleTypeDto.WRITING]: BattleType.WRITING,
    [BattleTypeDto.MIXED]: BattleType.MIXED,
  }[t];
}
function mapLevel(l: LevelDto): Level {
  return {
    [LevelDto.BASIC]: Level.BASIC,
    [LevelDto.MEDIUM]: Level.MEDIUM,
    [LevelDto.HIGH]: Level.HIGH,
  }[l];
}
function mapRole(r: PickRoleDto['role']): Role {
  return { listening: Role.LISTENING, reading: Role.READING, writing: Role.WRITING }[r];
}

@Injectable()
export class RoomService {
  private readonly ROOM_3V3_TIMEOUT_SEC = Number(process.env.ROOM_3V3_TIMEOUT_SEC ?? 60);
  private readonly ROOM_CODE_LEN = Number(process.env.ROOM_CODE_LEN ?? 6);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gateway: BattleGateway,
  ) {}

  async createRoom(hostUserId: string, dto: CreateRoomDto) {
    const mode = mapMode(dto.mode);

    const expiresAt =
      mode === Mode.THREE_VS_THREE
        ? new Date(Date.now() + this.ROOM_3V3_TIMEOUT_SEC * 1000)
        : new Date(Date.now() + 5 * 60 * 1000);

    // code collision safe
    let roomCode = genRoomCode(this.ROOM_CODE_LEN);
    for (let i = 0; i < 5; i++) {
      const exist = await this.prisma.battleRoom.findUnique({ where: { roomCode } });
      if (!exist) break;
      roomCode = genRoomCode(this.ROOM_CODE_LEN);
    }

    const room = await this.prisma.battleRoom.create({
      data: {
        roomCode,
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
      data: { roomId: room.id, userId: hostUserId, team: 'A', role: null, isReady: false },
    });

    await this.syncRoom(room.id);
    return { roomId: room.id, roomCode: room.roomCode, status: 'waiting', expiresAt: room.expiresAt.toISOString() };
  }

  async joinByCode(userId: string, roomCode: string) {
    const room = await this.prisma.battleRoom.findUnique({
      where: { roomCode },
      include: { members: { where: { leftAt: null } } },
    });
    if (!room) throw new NotFoundException('ROOM_NOT_FOUND');
    if (room.status !== RoomStatus.WAITING) throw new ConflictException('ROOM_NOT_JOINABLE');
    if (room.expiresAt.getTime() < Date.now()) throw new GoneException('ROOM_EXPIRED');

    const max = room.mode === Mode.THREE_VS_THREE ? 6 : 2;
    if (room.members.length >= max) throw new ConflictException('ROOM_FULL');

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
    return { roomId: room.id, status: 'waiting', expiresAt: room.expiresAt.toISOString() };
  }

  async getRoomState(roomId: string): Promise<RoomStateResponse> {
    const room = await this.prisma.battleRoom.findUnique({
      where: { id: roomId },
      include: { members: { where: { leftAt: null } } },
    });
    if (!room) throw new NotFoundException('ROOM_NOT_FOUND');

    return {
      roomId: room.id,
      roomCode: room.roomCode,
      mode: room.mode === Mode.ONE_VS_ONE ? '1v1' : '3v3',
      status: room.status.toLowerCase(),
      expiresAt: room.expiresAt.toISOString(),
      battleType: room.battleType.toLowerCase(),
      level: room.level.toLowerCase(),
      isRanked: room.isRanked,
      hostUserId: room.hostUserId,
      members: room.members.map(m => ({
        userId: m.userId,
        team: m.team as 'A' | 'B',
        role: m.role ? m.role.toLowerCase() : null,
        ready: m.isReady,
      })),
    };
  }

  async pickRole(userId: string, roomId: string, dto: PickRoleDto) {
    const lockKey = `lock:room:${roomId}:pick`;
    const token = await acquireLock(this.redis.client, lockKey, 3000);
    if (!token) throw new ConflictException('LOCKED_TRY_AGAIN');

    try {
      const room = await this.prisma.battleRoom.findUnique({ where: { id: roomId } });
      if (!room) throw new NotFoundException('ROOM_NOT_FOUND');
      if (room.mode !== Mode.THREE_VS_THREE) throw new BadRequestException('ROLE_ONLY_FOR_3V3');
      if (room.status !== RoomStatus.WAITING) throw new ConflictException('ROOM_NOT_WAITING');

      const member = await this.prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId } } });
      if (!member || member.leftAt) throw new ForbiddenException('NOT_IN_ROOM');

      const role = mapRole(dto.role);

      const taken = await this.prisma.roomMember.findFirst({
        where: { roomId, team: dto.team, role, leftAt: null },
      });
      if (taken && taken.userId !== userId) throw new ConflictException('ROLE_TAKEN');

      await this.prisma.roomMember.update({
        where: { roomId_userId: { roomId, userId } },
        data: { team: dto.team, role, isReady: false },
      });

      await this.syncRoom(roomId);
      return { ok: true };
    } finally {
      await releaseLock(this.redis.client, lockKey, token);
    }
  }

  async setReady(userId: string, roomId: string, ready: boolean) {
    const room = await this.prisma.battleRoom.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('ROOM_NOT_FOUND');
    if (room.status !== RoomStatus.WAITING) throw new ConflictException('ROOM_NOT_WAITING');
    if (room.expiresAt.getTime() < Date.now()) throw new GoneException('ROOM_EXPIRED');

    const member = await this.prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId } } });
    if (!member || member.leftAt) throw new ForbiddenException('NOT_IN_ROOM');

    if (room.mode === Mode.THREE_VS_THREE && ready && !member.role) {
      throw new BadRequestException('ROLE_REQUIRED');
    }

    await this.prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { isReady: ready },
    });

    await this.syncRoom(roomId);
    return { ok: true };
  }

  async startRoom(userId: string, roomId: string) {
    const lockKey = `lock:room:${roomId}:start`;
    const token = await acquireLock(this.redis.client, lockKey, 5000);
    if (!token) throw new ConflictException('LOCKED_TRY_AGAIN');

    try {
      const room = await this.prisma.battleRoom.findUnique({
        where: { id: roomId },
        include: { members: { where: { leftAt: null } } },
      });
      if (!room) throw new NotFoundException('ROOM_NOT_FOUND');
      if (room.hostUserId !== userId) throw new ForbiddenException('NOT_HOST');
      if (room.status !== RoomStatus.WAITING) throw new ConflictException('ROOM_NOT_WAITING');
      if (room.expiresAt.getTime() < Date.now()) throw new GoneException('ROOM_EXPIRED');

      const expected = room.mode === Mode.THREE_VS_THREE ? 6 : 2;
      if (room.members.length !== expected) throw new BadRequestException('NOT_ENOUGH_PLAYERS');
      if (room.members.some(m => !m.isReady)) throw new BadRequestException('NOT_READY');

      if (room.mode === Mode.THREE_VS_THREE) {
        const need = [Role.LISTENING, Role.READING, Role.WRITING];
        const rolesOf = (t: 'A' | 'B') =>
          new Set(room.members.filter(m => m.team === t).map(m => m.role).filter(Boolean) as Role[]);
        const a = rolesOf('A');
        const b = rolesOf('B');
        if (!need.every(r => a.has(r)) || !need.every(r => b.has(r))) {
          throw new BadRequestException('ROLES_INCOMPLETE');
        }
      }

      const battleId = randomUUID();

      await this.prisma.battleRoom.update({
        where: { id: roomId },
        data: { status: RoomStatus.PLAYING, startedAt: new Date() },
      });

      await this.syncRoom(roomId);
      return { battleId, status: 'playing' };
    } finally {
      await releaseLock(this.redis.client, lockKey, token);
    }
  }

  private async syncRoom(roomId: string) {
    const state = await this.getRoomState(roomId);
    await this.redis.client.set(`room:${roomId}`, JSON.stringify(state), 'PX', 120_000);
    this.gateway.emitRoomUpdated(roomId, state);
  }
}
