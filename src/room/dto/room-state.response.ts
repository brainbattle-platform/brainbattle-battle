export type RoomStateResponse = {
  roomId: string;
  mode: '1v1' | '3v3';
  status: string;
  expiresAt: string;
  roomCode?: string;
  battleType?: string;
  level?: string;
  isRanked?: boolean;
  hostUserId?: string;
  members: Array<{
    userId: string;
    team: 'A' | 'B';
    role: string | null;
    ready: boolean;
  }>;
};
