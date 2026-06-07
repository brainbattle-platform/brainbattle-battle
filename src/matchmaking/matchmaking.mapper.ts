import type { MatchmakingQueueEntry } from '@prisma/client';

export function toMatchmakingEntryResponse(entry: MatchmakingQueueEntry) {
  return {
    id: entry.id,
    userId: entry.userId,
    format: entry.format,
    skill: entry.skill,
    role: entry.role,
    rankTier: entry.rankTier,
    rankStars: entry.rankStars,
    matchmakingScore: entry.matchmakingScore,
    status: entry.status,
    roomId: entry.roomId,
    matchedWithUserId: entry.matchedWithUserId,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    expiresAt: entry.expiresAt,
    matchedAt: entry.matchedAt,
    cancelledAt: entry.cancelledAt,
  };
}