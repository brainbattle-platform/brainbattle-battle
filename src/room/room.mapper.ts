import { BattleRoom, RoomMember } from '@prisma/client';

type RoomWithMembers = BattleRoom & {
  members: RoomMember[];
};

export function toRoomResponse(room: RoomWithMembers) {
  return {
    id: room.id,
    code: room.code,
    hostUserId: room.hostUserId,
    format: room.format,
    skill: room.skill,
    isRanked: room.isRanked,
    status: room.status,
    expiresAt: room.expiresAt,
    startedAt: room.startedAt,
    closedAt: room.closedAt,
    closeReason: room.closeReason,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    maxPlayers: room.format === 'DUEL_1V1' ? 2 : 6,
    members: room.members
      .filter((member) => !member.leftAt)
      .map((member) => ({
        id: member.id,
        userId: member.userId,
        team: member.team,
        role: member.role,
        isReady: member.isReady,
        joinedAt: member.joinedAt,
      })),
  };
}