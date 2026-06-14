import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BattleFormat,
  BattleRole,
  BattleRoomStatus,
  BattleSkill,
  Prisma,
  RoomTeam,
} from '@prisma/client';
import { addMinutes } from 'date-fns';
import { env } from '../common/env';
import { PrismaService } from '../prisma/prisma.service';
import { AdminListRoomsDto, ChangeSlotDto, CreateRoomDto, JoinRoomDto } from './dto';
import { toRoomResponse } from './room.mapper';
import { RoomEventsService } from './room-events.service';

@Injectable()
export class RoomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: RoomEventsService,
  ) { }

  async createRoom(userId: string, dto: CreateRoomDto) {
    const normalized = this.normalizeCreateRoomDto(dto);

    const room = await this.prisma.$transaction(async (tx) => {
      const createdRoom = await tx.battleRoom.create({
        data: {
          code: await this.generateUniqueRoomCode(tx),
          hostUserId: userId,
          format: normalized.format,
          skill: normalized.skill,
          isRanked: normalized.isRanked,
          status: BattleRoomStatus.WAITING,
          expiresAt: addMinutes(new Date(), env.ROOM_EXPIRE_MINUTES),
        },
      });

      await tx.roomMember.create({
        data: {
          roomId: createdRoom.id,
          userId,
          team: normalized.hostTeam,
          role: normalized.hostRole,
          isReady: false,
        },
      });

      return tx.battleRoom.findUniqueOrThrow({
        where: { id: createdRoom.id },
        include: { members: true },
      });
    });

    return toRoomResponse(room);
  }

  async joinByCode(userId: string, dto: JoinRoomDto) {
    const room = await this.prisma.battleRoom.findUnique({
      where: { code: dto.roomCode.trim().toUpperCase() },
      include: { members: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    this.assertRoomJoinable(room.status, room.expiresAt);

    const activeMembers = room.members.filter((member) => !member.leftAt);
    const existingMember = activeMembers.find(
      (member) => member.userId === userId,
    );

    if (existingMember) {
      return toRoomResponse(room);
    }

    const maxPlayers = this.getMaxPlayers(room.format);

    if (activeMembers.length >= maxPlayers) {
      throw new BadRequestException('Room is full');
    }

    const slot = this.resolveJoinSlot(room.format, activeMembers, dto);

    await this.assertSlotAvailable(room.id, slot.team, slot.role);

    const updatedRoom = await this.prisma.$transaction(async (tx) => {
      await tx.roomMember.create({
        data: {
          roomId: room.id,
          userId,
          team: slot.team,
          role: slot.role,
          isReady: false,
        },
      });

      await tx.battleRoom.update({
        where: { id: room.id },
        data: { status: BattleRoomStatus.WAITING },
      });

      return tx.battleRoom.findUniqueOrThrow({
        where: { id: room.id },
        include: { members: true },
      });
    });

    return toRoomResponse(updatedRoom);
  }

  async getRoom(roomId: string) {
    const room = await this.getRoomOrThrow(roomId);
    return toRoomResponse(room);
  }

  async getRoomByCode(roomCode: string) {
    const room = await this.prisma.battleRoom.findUnique({
      where: { code: roomCode.trim().toUpperCase() },
      include: { members: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return toRoomResponse(room);
  }

  async getMyActiveRoom(userId: string) {
    const member = await this.prisma.roomMember.findFirst({
      where: {
        userId,
        leftAt: null,
        room: {
          status: {
            in: [
              BattleRoomStatus.WAITING,
              BattleRoomStatus.READY,
              BattleRoomStatus.PLAYING,
            ],
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
      include: {
        room: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!member) {
      return null;
    }

    return toRoomResponse(member.room);
  }

  async setReady(userId: string, roomId: string, isReady: boolean) {
    const room = await this.getRoomOrThrow(roomId);

    this.assertRoomJoinable(room.status, room.expiresAt);

    const member = room.members.find(
      (item) => item.userId === userId && !item.leftAt,
    );

    if (!member) {
      throw new ForbiddenException('You are not in this room');
    }

    const updatedRoom = await this.prisma.$transaction(async (tx) => {
      await tx.roomMember.update({
        where: { id: member.id },
        data: { isReady },
      });

      const refreshedRoom = await tx.battleRoom.findUniqueOrThrow({
        where: { id: roomId },
        include: { members: true },
      });

      const nextStatus = this.calculateRoomStatus(refreshedRoom);

      if (refreshedRoom.status !== nextStatus) {
        await tx.battleRoom.update({
          where: { id: roomId },
          data: { status: nextStatus },
        });
      }

      return tx.battleRoom.findUniqueOrThrow({
        where: { id: roomId },
        include: { members: true },
      });
    });

    const response = toRoomResponse(updatedRoom);

    this.events.emitToRoom(roomId, 'room.ready.changed', {
      room: response,
      userId,
      isReady,
    });

    this.events.emitToRoom(roomId, 'room.updated', response);

    if (response.status === BattleRoomStatus.READY) {
      this.events.emitToRoom(roomId, 'room.ready.all', {
        room: response,
        message: 'All players are ready. Host can start battle.',
      });
    }

    return response;
  }

  async changeSlot(userId: string, roomId: string, dto: ChangeSlotDto) {
    const room = await this.getRoomOrThrow(roomId);

    if (room.format !== BattleFormat.TEAM_3V3) {
      throw new BadRequestException('Slot change is only available for TEAM_3V3');
    }

    this.assertRoomJoinable(room.status, room.expiresAt);

    const member = room.members.find(
      (item) => item.userId === userId && !item.leftAt,
    );

    if (!member) {
      throw new ForbiddenException('You are not in this room');
    }

    await this.assertSlotAvailable(roomId, dto.team, dto.role, member.id);

    const updatedRoom = await this.prisma.$transaction(async (tx) => {
      await tx.roomMember.update({
        where: { id: member.id },
        data: {
          team: dto.team,
          role: dto.role,
          isReady: false,
        },
      });

      await tx.battleRoom.update({
        where: { id: roomId },
        data: { status: BattleRoomStatus.WAITING },
      });

      return tx.battleRoom.findUniqueOrThrow({
        where: { id: roomId },
        include: { members: true },
      });
    });

    const response = toRoomResponse(updatedRoom);

    this.events.emitToRoom(roomId, 'room.slot.changed', {
      room: response,
      userId,
    });

    this.events.emitToRoom(roomId, 'room.updated', response);

    return response;
  }

  async leaveRoom(userId: string, roomId: string) {
    const room = await this.getRoomOrThrow(roomId);

    if (
      room.status === BattleRoomStatus.PLAYING ||
      room.status === BattleRoomStatus.FINISHED
    ) {
      throw new BadRequestException(
        'Cannot leave a room that is already playing or finished',
      );
    }

    const member = room.members.find(
      (item) => item.userId === userId && !item.leftAt,
    );

    if (!member) {
      throw new ForbiddenException('You are not in this room');
    }

    const updatedRoom = await this.prisma.$transaction(async (tx) => {
      await tx.roomMember.update({
        where: { id: member.id },
        data: {
          leftAt: new Date(),
          isReady: false,
        },
      });

      const activeMembers = await tx.roomMember.findMany({
        where: {
          roomId,
          leftAt: null,
        },
      });

      if (activeMembers.length === 0 || room.hostUserId === userId) {
        await tx.battleRoom.update({
          where: { id: roomId },
          data: {
            status: BattleRoomStatus.CANCELLED,
            closedAt: new Date(),
            closeReason:
              room.hostUserId === userId ? 'HOST_LEFT' : 'EMPTY_ROOM',
          },
        });
      } else {
        await tx.battleRoom.update({
          where: { id: roomId },
          data: {
            status: BattleRoomStatus.WAITING,
          },
        });
      }

      return tx.battleRoom.findUniqueOrThrow({
        where: { id: roomId },
        include: { members: true },
      });
    });

    const response = toRoomResponse(updatedRoom);

    this.events.emitToRoom(roomId, 'room.player.left', {
      room: response,
      userId,
    });

    this.events.emitToRoom(roomId, 'room.updated', response);

    return response;
  }

  async cancelRoom(userId: string, roomId: string) {
    const room = await this.getRoomOrThrow(roomId);

    if (room.hostUserId !== userId) {
      throw new ForbiddenException('Only host can cancel this room');
    }

    if (
      room.status === BattleRoomStatus.PLAYING ||
      room.status === BattleRoomStatus.FINISHED
    ) {
      throw new BadRequestException(
        'Cannot cancel a room that is already playing or finished',
      );
    }

    const updatedRoom = await this.prisma.battleRoom.update({
      where: { id: roomId },
      data: {
        status: BattleRoomStatus.CANCELLED,
        closedAt: new Date(),
        closeReason: 'HOST_CANCELLED',
      },
      include: { members: true },
    });

    const response = toRoomResponse(updatedRoom);

    this.events.emitToRoom(roomId, 'room.cancelled', {
      room: response,
      userId,
    });

    this.events.emitToRoom(roomId, 'room.updated', response);

    return response;
  }

  async startCheck(userId: string, roomId: string) {
    const room = await this.getRoomOrThrow(roomId);

    if (room.hostUserId !== userId) {
      throw new ForbiddenException('Only host can start this room');
    }

    if (room.status !== BattleRoomStatus.READY) {
      throw new BadRequestException('Room is not ready');
    }

    const activeMembers = room.members.filter((member) => !member.leftAt);
    const maxPlayers = this.getMaxPlayers(room.format);

    if (activeMembers.length !== maxPlayers) {
      throw new BadRequestException('Room does not have enough players');
    }

    if (room.format === BattleFormat.TEAM_3V3) {
      this.assertValidTeam3v3Composition(activeMembers);
    }

    return {
      canStart: true,
      room: toRoomResponse(room),
    };
  }

  async assertRoomReadyForBattle(roomId: string) {
    const room = await this.getRoomOrThrow(roomId);

    if (room.status !== BattleRoomStatus.READY) {
      throw new BadRequestException('Room is not ready');
    }

    return room;
  }

  async markRoomPlaying(roomId: string) {
    const room = await this.prisma.battleRoom.update({
      where: { id: roomId },
      data: {
        status: BattleRoomStatus.PLAYING,
        startedAt: new Date(),
      },
      include: { members: true },
    });

    return toRoomResponse(room);
  }

  private normalizeCreateRoomDto(dto: CreateRoomDto) {
    if (dto.format === BattleFormat.DUEL_1V1) {
      return {
        format: dto.format,
        skill: dto.skill,
        isRanked: dto.isRanked ?? false,
        hostTeam: RoomTeam.A,
        hostRole: null,
      };
    }

    if (dto.skill !== BattleSkill.MIXED) {
      throw new BadRequestException('TEAM_3V3 must use MIXED skill');
    }

    if (!dto.team || !dto.role) {
      throw new BadRequestException('TEAM_3V3 requires host team and role');
    }

    return {
      format: dto.format,
      skill: BattleSkill.MIXED,
      isRanked: dto.isRanked ?? false,
      hostTeam: dto.team,
      hostRole: dto.role,
    };
  }

  private resolveJoinSlot(
    format: BattleFormat,
    activeMembers: Array<{ team: RoomTeam; role: BattleRole | null }>,
    dto: JoinRoomDto,
  ) {
    if (format === BattleFormat.DUEL_1V1) {
      const hasTeamA = activeMembers.some(
        (member) => member.team === RoomTeam.A,
      );
      const hasTeamB = activeMembers.some(
        (member) => member.team === RoomTeam.B,
      );

      if (!hasTeamA) {
        return { team: RoomTeam.A, role: null };
      }

      if (!hasTeamB) {
        return { team: RoomTeam.B, role: null };
      }

      throw new BadRequestException('Room is full');
    }

    if (!dto.team || !dto.role) {
      throw new BadRequestException('TEAM_3V3 requires team and role');
    }

    return {
      team: dto.team,
      role: dto.role,
    };
  }

  private async assertSlotAvailable(
    roomId: string,
    team: RoomTeam,
    role: BattleRole | null,
    currentMemberId?: string,
  ) {
    if (!role) return;

    const existing = await this.prisma.roomMember.findFirst({
      where: {
        roomId,
        team,
        role,
        leftAt: null,
        id: currentMemberId ? { not: currentMemberId } : undefined,
      },
    });

    if (existing) {
      throw new BadRequestException(`Slot ${team}/${role} is already taken`);
    }
  }

  private calculateRoomStatus(room: {
    format: BattleFormat;
    members: Array<{
      leftAt: Date | null;
      isReady: boolean;
      role: BattleRole | null;
      team: RoomTeam;
    }>;
  }) {
    const activeMembers = room.members.filter((member) => !member.leftAt);
    const maxPlayers = this.getMaxPlayers(room.format);

    if (activeMembers.length !== maxPlayers) {
      return BattleRoomStatus.WAITING;
    }

    if (room.format === BattleFormat.TEAM_3V3) {
      this.assertValidTeam3v3Composition(activeMembers);
    }

    const allReady = activeMembers.every((member) => member.isReady);

    return allReady ? BattleRoomStatus.READY : BattleRoomStatus.WAITING;
  }

  private assertValidTeam3v3Composition(
    members: Array<{ team: RoomTeam; role: BattleRole | null }>,
  ) {
    const requiredRoles = [
      BattleRole.GRAMMAR,
      BattleRole.LISTENING,
      BattleRole.VOCABULARY,
    ];

    for (const team of [RoomTeam.A, RoomTeam.B]) {
      const teamMembers = members.filter((member) => member.team === team);

      if (teamMembers.length !== 3) {
        throw new BadRequestException(
          `Team ${team} must have exactly 3 players`,
        );
      }

      for (const role of requiredRoles) {
        const count = teamMembers.filter(
          (member) => member.role === role,
        ).length;

        if (count !== 1) {
          throw new BadRequestException(
            `Team ${team} must have exactly one ${role} role`,
          );
        }
      }
    }
  }

  private assertRoomJoinable(status: BattleRoomStatus, expiresAt: Date | null) {
    if (status === BattleRoomStatus.EXPIRED) {
      throw new BadRequestException('Room has expired');
    }

    if (expiresAt && expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Room has expired');
    }

    if (
      status !== BattleRoomStatus.WAITING &&
      status !== BattleRoomStatus.READY
    ) {
      throw new BadRequestException('Room is not joinable');
    }
  }

  private async getRoomOrThrow(roomId: string) {
    const room = await this.prisma.battleRoom.findUnique({
      where: { id: roomId },
      include: { members: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  private getMaxPlayers(format: BattleFormat) {
    return format === BattleFormat.DUEL_1V1 ? 2 : 6;
  }

  private async generateUniqueRoomCode(tx: Prisma.TransactionClient) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = this.generateRoomCode();

      const existing = await tx.battleRoom.findUnique({
        where: { code },
      });

      if (!existing) {
        return code;
      }
    }

    throw new BadRequestException('Failed to generate room code');
  }

  private generateRoomCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';

    for (let i = 0; i < env.ROOM_CODE_LEN; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    return code;
  }
  async adminListRooms(query: AdminListRoomsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.BattleRoomWhereInput = {
      status: query.status,
      format: query.format,
      code: query.code ? query.code.trim().toUpperCase() : undefined,
      members: query.userId
        ? {
          some: {
            userId: query.userId,
            leftAt: null,
          },
        }
        : undefined,
    };

    const [total, rooms] = await this.prisma.$transaction([
      this.prisma.battleRoom.count({ where }),
      this.prisma.battleRoom.findMany({
        where,
        include: { members: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items: rooms.map(toRoomResponse),
    };
  }

  async adminGetRoomDetail(roomId: string) {
    const room = await this.getRoomOrThrow(roomId);

    return {
      ...toRoomResponse(room),
      analysis: this.buildRoomAnalysis(room),
    };
  }

  async adminForceCancelRoom(adminUserId: string, roomId: string) {
    const room = await this.getRoomOrThrow(roomId);

    if (room.status === BattleRoomStatus.FINISHED) {
      throw new BadRequestException('Cannot force cancel a finished room');
    }

    const updatedRoom = await this.prisma.battleRoom.update({
      where: { id: roomId },
      data: {
        status: BattleRoomStatus.CANCELLED,
        closedAt: new Date(),
        closeReason: `ADMIN_FORCE_CANCELLED:${adminUserId}`,
      },
      include: { members: true },
    });

    return {
      ...toRoomResponse(updatedRoom),
      analysis: this.buildRoomAnalysis(updatedRoom),
    };
  }

  private buildRoomAnalysis(room: {
    format: BattleFormat;
    status: BattleRoomStatus;
    expiresAt: Date | null;
    members: Array<{
      leftAt: Date | null;
      isReady: boolean;
      team: RoomTeam;
      role: BattleRole | null;
    }>;
  }) {
    const activeMembers = room.members.filter((member) => !member.leftAt);
    const maxPlayers = this.getMaxPlayers(room.format);
    const readyMembers = activeMembers.filter((member) => member.isReady);

    const teamA = activeMembers.filter((member) => member.team === RoomTeam.A);
    const teamB = activeMembers.filter((member) => member.team === RoomTeam.B);

    return {
      activePlayerCount: activeMembers.length,
      maxPlayers,
      readyPlayerCount: readyMembers.length,
      isFull: activeMembers.length === maxPlayers,
      isAllReady:
        activeMembers.length === maxPlayers &&
        activeMembers.every((member) => member.isReady),
      isExpired: Boolean(room.expiresAt && room.expiresAt.getTime() < Date.now()),
      teamSummary: {
        A: {
          count: teamA.length,
          roles: teamA.map((member) => member.role).filter(Boolean),
        },
        B: {
          count: teamB.length,
          roles: teamB.map((member) => member.role).filter(Boolean),
        },
      },
    };
  }
}