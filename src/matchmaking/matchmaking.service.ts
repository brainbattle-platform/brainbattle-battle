import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BattleFormat,
  BattleRole,
  BattleRoomStatus,
  BattleSkill,
  MatchmakingQueueEntry,
  MatchmakingQueueStatus,
  Prisma,
  RoomTeam,
} from '@prisma/client';
import { addSeconds } from 'date-fns';
import { env } from '../common/env';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { JoinMatchmakingDto } from './dto';
import { MatchmakingEventsService } from './matchmaking-events.service';
import { toMatchmakingEntryResponse } from './matchmaking.mapper';

type NormalizedJoinInput = {
  format: BattleFormat;
  skill: BattleSkill;
  role: BattleRole | null;
  isRanked: boolean;
};

type TeamPickResult = {
  teamA: MatchmakingQueueEntry[];
  teamB: MatchmakingQueueEntry[];
  averageDiff: number;
};

@Injectable()
export class MatchmakingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly events: MatchmakingEventsService,
  ) {}

  async joinQueue(userId: string, dto: JoinMatchmakingDto) {
    const normalized = this.normalizeJoinDto(dto);

    await this.expireOldWaitingEntries();

    const existingActive = await this.prisma.matchmakingQueueEntry.findFirst({
      where: {
        userId,
        status: {
          in: [MatchmakingQueueStatus.WAITING, MatchmakingQueueStatus.MATCHED],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existingActive) {
      const room = existingActive.roomId
        ? await this.prisma.battleRoom.findUnique({
            where: { id: existingActive.roomId },
            include: { members: true },
          })
        : null;

      const payload = {
        status: existingActive.status,
        entry: toMatchmakingEntryResponse(existingActive),
        room,
      };

      this.events.emitToUser(userId, 'queue.status', payload);

      return payload;
    }

    const profile = await this.userService.getPublicProfile(userId);
    const rankTier = profile.rank?.tier ?? 'BRONZE';
    const rankStars = profile.rank?.stars ?? 0;
    const matchmakingScore = this.toMatchmakingScore(rankTier, rankStars);

    if (normalized.format === BattleFormat.DUEL_1V1) {
      return this.joinDuelQueue(
        userId,
        normalized,
        rankTier,
        rankStars,
        matchmakingScore,
      );
    }

    return this.joinTeamQueue(
      userId,
      normalized,
      rankTier,
      rankStars,
      matchmakingScore,
    );
  }

  async leaveQueue(userId: string) {
    const entry = await this.prisma.matchmakingQueueEntry.findFirst({
      where: {
        userId,
        status: MatchmakingQueueStatus.WAITING,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!entry) {
      const payload = {
        status: 'NO_ACTIVE_QUEUE',
        entry: null,
      };

      this.events.emitToUser(userId, 'queue.left', payload);

      return payload;
    }

    const updated = await this.prisma.matchmakingQueueEntry.update({
      where: {
        id: entry.id,
      },
      data: {
        status: MatchmakingQueueStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    const payload = {
      status: 'CANCELLED',
      entry: toMatchmakingEntryResponse(updated),
    };

    this.events.emitToUser(userId, 'queue.left', payload);

    return payload;
  }

  async getMyQueueStatus(userId: string) {
    await this.expireOldWaitingEntries(userId);

    const entry = await this.prisma.matchmakingQueueEntry.findFirst({
      where: {
        userId,
        status: {
          in: [MatchmakingQueueStatus.WAITING, MatchmakingQueueStatus.MATCHED],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!entry) {
      return {
        status: 'IDLE',
        entry: null,
        room: null,
      };
    }

    const room = entry.roomId
      ? await this.prisma.battleRoom.findUnique({
          where: {
            id: entry.roomId,
          },
          include: {
            members: true,
          },
        })
      : null;

    return {
      status: entry.status,
      entry: toMatchmakingEntryResponse(entry),
      room,
    };
  }

  private async joinDuelQueue(
    userId: string,
    normalized: NormalizedJoinInput,
    rankTier: string,
    rankStars: number,
    matchmakingScore: number,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const opponent = await this.findDuelOpponent(tx, {
        userId,
        format: normalized.format,
        skill: normalized.skill,
        matchmakingScore,
      });

      if (!opponent) {
        const entry = await tx.matchmakingQueueEntry.create({
          data: {
            userId,
            format: BattleFormat.DUEL_1V1,
            skill: normalized.skill,
            role: null,
            rankTier,
            rankStars,
            matchmakingScore,
            status: MatchmakingQueueStatus.WAITING,
            expiresAt: this.buildQueueExpiry(),
          },
        });

        return {
          status: 'WAITING',
          entry,
          room: null,
        };
      }

      const roomCode = await this.generateUniqueRoomCode(tx);

      const room = await tx.battleRoom.create({
        data: {
          code: roomCode,
          hostUserId: opponent.userId,
          format: BattleFormat.DUEL_1V1,
          skill: normalized.skill,
          isRanked: normalized.isRanked,
          status: BattleRoomStatus.WAITING,
          expiresAt: this.buildQueueExpiry(),
          members: {
            create: [
              {
                userId: opponent.userId,
                team: RoomTeam.A,
                role: null,
                isReady: false,
              },
              {
                userId,
                team: RoomTeam.B,
                role: null,
                isReady: false,
              },
            ],
          },
        },
        include: {
          members: true,
        },
      });

      await tx.matchmakingQueueEntry.update({
        where: { id: opponent.id },
        data: {
          status: MatchmakingQueueStatus.MATCHED,
          roomId: room.id,
          matchedWithUserId: userId,
          matchedAt: new Date(),
        },
      });

      const currentEntry = await tx.matchmakingQueueEntry.create({
        data: {
          userId,
          format: BattleFormat.DUEL_1V1,
          skill: normalized.skill,
          role: null,
          rankTier,
          rankStars,
          matchmakingScore,
          status: MatchmakingQueueStatus.MATCHED,
          roomId: room.id,
          matchedWithUserId: opponent.userId,
          matchedAt: new Date(),
          expiresAt: this.buildQueueExpiry(),
        },
      });

      return {
        status: 'MATCHED',
        entry: currentEntry,
        room,
        matchedUserIds: [opponent.userId, userId],
      };
    });

    const payload = {
      status: result.status,
      entry: toMatchmakingEntryResponse(result.entry),
      room: result.room,
    };

    if (result.status === 'MATCHED' && result.room) {
      this.events.emitToUsers(result.matchedUserIds ?? [userId], 'match.found', {
        room: result.room,
        format: BattleFormat.DUEL_1V1,
        skill: normalized.skill,
      });
    } else {
      this.events.emitToUser(userId, 'queue.waiting', payload);
    }

    return payload;
  }

  private async joinTeamQueue(
    userId: string,
    normalized: NormalizedJoinInput,
    rankTier: string,
    rankStars: number,
    matchmakingScore: number,
  ) {
    if (!normalized.role) {
      throw new BadRequestException('role is required for TEAM_3V3 matchmaking');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const currentEntry = await tx.matchmakingQueueEntry.create({
        data: {
          userId,
          format: BattleFormat.TEAM_3V3,
          skill: normalized.skill,
          role: normalized.role,
          rankTier,
          rankStars,
          matchmakingScore,
          status: MatchmakingQueueStatus.WAITING,
          expiresAt: this.buildQueueExpiry(),
        },
      });

      const candidates = await tx.matchmakingQueueEntry.findMany({
        where: {
          format: BattleFormat.TEAM_3V3,
          skill: normalized.skill,
          status: MatchmakingQueueStatus.WAITING,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      const selected = this.pickTeam3v3Candidates(candidates);

      if (!selected) {
        return {
          status: 'WAITING',
          entry: currentEntry,
          room: null,
        };
      }

      const roomCode = await this.generateUniqueRoomCode(tx);
      const allPlayers = [...selected.teamA, ...selected.teamB];

      const room = await tx.battleRoom.create({
        data: {
          code: roomCode,
          hostUserId: selected.teamA[0].userId,
          format: BattleFormat.TEAM_3V3,
          skill: normalized.skill,
          isRanked: normalized.isRanked,
          status: BattleRoomStatus.WAITING,
          expiresAt: this.buildQueueExpiry(),
          members: {
            create: [
              ...selected.teamA.map((entry) => ({
                userId: entry.userId,
                team: RoomTeam.A,
                role: entry.role,
                isReady: false,
              })),
              ...selected.teamB.map((entry) => ({
                userId: entry.userId,
                team: RoomTeam.B,
                role: entry.role,
                isReady: false,
              })),
            ],
          },
        },
        include: {
          members: true,
        },
      });

      for (const entry of allPlayers) {
        const sameRoleOpponent =
          allPlayers.find(
            (item) =>
              item.userId !== entry.userId &&
              item.role === entry.role &&
              this.getEntryTeam(item, selected) !== this.getEntryTeam(entry, selected),
          ) ?? allPlayers.find((item) => item.userId !== entry.userId);

        await tx.matchmakingQueueEntry.update({
          where: { id: entry.id },
          data: {
            status: MatchmakingQueueStatus.MATCHED,
            roomId: room.id,
            matchedWithUserId: sameRoleOpponent?.userId ?? null,
            matchedAt: new Date(),
          },
        });
      }

      const updatedCurrentEntry =
        await tx.matchmakingQueueEntry.findUniqueOrThrow({
          where: { id: currentEntry.id },
        });

      return {
        status: 'MATCHED',
        entry: updatedCurrentEntry,
        room,
        matchedUserIds: allPlayers.map((item) => item.userId),
        averageDiff: selected.averageDiff,
      };
    });

    const payload = {
      status: result.status,
      entry: toMatchmakingEntryResponse(result.entry),
      room: result.room,
      averageDiff: result.averageDiff ?? null,
    };

    if (result.status === 'MATCHED' && result.room) {
      this.events.emitToUsers(result.matchedUserIds ?? [userId], 'match.found', {
        room: result.room,
        format: BattleFormat.TEAM_3V3,
        skill: normalized.skill,
        averageDiff: result.averageDiff ?? null,
      });
    } else {
      this.events.emitToUser(userId, 'queue.waiting', payload);
    }

    return payload;
  }

  private normalizeJoinDto(dto: JoinMatchmakingDto): NormalizedJoinInput {
    if (dto.format === BattleFormat.TEAM_3V3 && !dto.role) {
      throw new BadRequestException('role is required for TEAM_3V3 matchmaking');
    }

    if (dto.format === BattleFormat.DUEL_1V1) {
      return {
        format: BattleFormat.DUEL_1V1,
        skill: dto.skill,
        role: null,
        isRanked: dto.isRanked ?? true,
      };
    }

    if (dto.skill !== BattleSkill.MIXED) {
      throw new BadRequestException(
        'TEAM_3V3 matchmaking currently requires skill=MIXED because roles decide question type.',
      );
    }

    return {
      format: BattleFormat.TEAM_3V3,
      skill: BattleSkill.MIXED,
      role: dto.role ?? null,
      isRanked: dto.isRanked ?? true,
    };
  }

  private async findDuelOpponent(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      format: BattleFormat;
      skill: BattleSkill;
      matchmakingScore: number;
    },
  ) {
    const candidates = await tx.matchmakingQueueEntry.findMany({
      where: {
        userId: {
          not: input.userId,
        },
        format: input.format,
        skill: input.skill,
        status: MatchmakingQueueStatus.WAITING,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return (
      candidates.find((candidate) => {
        if (candidate.matchmakingScore === null) {
          return false;
        }

        return (
          Math.abs(candidate.matchmakingScore - input.matchmakingScore) <=
          env.DUEL_MATCH_SCORE_DELTA
        );
      }) ?? null
    );
  }

  private pickTeam3v3Candidates(
    candidates: MatchmakingQueueEntry[],
  ): TeamPickResult | null {
    const validCandidates = candidates.filter(
      (entry) => entry.matchmakingScore !== null && entry.role !== null,
    );

    const grammar = validCandidates.filter(
      (entry) => entry.role === BattleRole.GRAMMAR,
    );
    const listening = validCandidates.filter(
      (entry) => entry.role === BattleRole.LISTENING,
    );
    const vocabulary = validCandidates.filter(
      (entry) => entry.role === BattleRole.VOCABULARY,
    );

    if (grammar.length < 2 || listening.length < 2 || vocabulary.length < 2) {
      return null;
    }

    let bestPick: TeamPickResult | null = null;

    for (const grammarPair of this.takeCandidatePairs(grammar)) {
      for (const listeningPair of this.takeCandidatePairs(listening)) {
        for (const vocabularyPair of this.takeCandidatePairs(vocabulary)) {
          const rolePairs = [grammarPair, listeningPair, vocabularyPair];

          for (const variant of this.buildTeamVariants(rolePairs)) {
            const averageDiff = Math.abs(
              this.averageScore(variant.teamA) - this.averageScore(variant.teamB),
            );

            if (averageDiff > env.TEAM_MATCH_AVG_SCORE_DELTA) {
              continue;
            }

            if (!bestPick || averageDiff < bestPick.averageDiff) {
              bestPick = {
                ...variant,
                averageDiff,
              };
            }
          }
        }
      }
    }

    return bestPick;
  }

  private takeCandidatePairs(entries: MatchmakingQueueEntry[]) {
    const limited = entries.slice(0, 8);
    const pairs: [MatchmakingQueueEntry, MatchmakingQueueEntry][] = [];

    for (let i = 0; i < limited.length; i += 1) {
      for (let j = i + 1; j < limited.length; j += 1) {
        pairs.push([limited[i], limited[j]]);
      }
    }

    return pairs;
  }

  private buildTeamVariants(
    rolePairs: [MatchmakingQueueEntry, MatchmakingQueueEntry][],
  ) {
    const variants: Array<{
      teamA: MatchmakingQueueEntry[];
      teamB: MatchmakingQueueEntry[];
    }> = [];

    for (let mask = 0; mask < 8; mask += 1) {
      const teamA: MatchmakingQueueEntry[] = [];
      const teamB: MatchmakingQueueEntry[] = [];

      for (let roleIndex = 0; roleIndex < rolePairs.length; roleIndex += 1) {
        const pair = rolePairs[roleIndex];
        const swap = (mask & (1 << roleIndex)) !== 0;

        teamA.push(swap ? pair[1] : pair[0]);
        teamB.push(swap ? pair[0] : pair[1]);
      }

      variants.push({ teamA, teamB });
    }

    return variants;
  }

  private averageScore(entries: MatchmakingQueueEntry[]) {
    const total = entries.reduce(
      (sum, entry) => sum + (entry.matchmakingScore ?? 0),
      0,
    );

    return total / entries.length;
  }

  private getEntryTeam(
    entry: MatchmakingQueueEntry,
    selected: {
      teamA: MatchmakingQueueEntry[];
      teamB: MatchmakingQueueEntry[];
    },
  ) {
    if (selected.teamA.some((item) => item.id === entry.id)) {
      return RoomTeam.A;
    }

    return RoomTeam.B;
  }

  private async expireOldWaitingEntries(userId?: string) {
    await this.prisma.matchmakingQueueEntry.updateMany({
      where: {
        ...(userId ? { userId } : {}),
        status: MatchmakingQueueStatus.WAITING,
        expiresAt: {
          lte: new Date(),
        },
      },
      data: {
        status: MatchmakingQueueStatus.EXPIRED,
      },
    });
  }

  private async generateUniqueRoomCode(tx: Prisma.TransactionClient) {
    const len = env.ROOM_CODE_LEN;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = this.generateRoomCode(len);

      const existing = await tx.battleRoom.findUnique({
        where: { code },
      });

      if (!existing) {
        return code;
      }
    }

    throw new BadRequestException('Could not generate unique room code');
  }

  private generateRoomCode(length: number) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';

    for (let i = 0; i < length; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    return code;
  }

  private buildQueueExpiry() {
    return addSeconds(new Date(), env.MATCHMAKING_QUEUE_EXPIRE_SECONDS);
  }

  private toMatchmakingScore(rankTier: string, stars: number) {
    const tierBase: Record<string, number> = {
      BRONZE: 0,
      SILVER: 10,
      GOLD: 20,
      CHALLENGER: 30,
    };

    return (tierBase[rankTier] ?? 0) + stars;
  }
}