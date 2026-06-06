export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  roles?: string[];
  profile?: {
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
    status?: string | null;
  } | null;
  learnerProfile?: unknown | null;
  raw?: unknown;
}

export interface AuthContextMeResponse {
  user_id: string;
  email?: string;
  roles?: string[];
  profile?: {
    username?: string | null;
    display_name?: string | null;
    displayName?: string | null;
    avatar_url?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
    status?: string | null;
  } | null;
  learner_profile?: unknown | null;
  learnerProfile?: unknown | null;
}

export interface PublicUserProfile {
  userId: string;
  email?: string | null;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  status?: string | null;
  learner?: {
    onboardingCompleted?: boolean;
    goalType?: string | null;
    currentLevel?: string | null;
    targetLevel?: string | null;
    nativeLanguage?: string | null;
    targetLanguage?: string | null;
    focusSkills?: unknown;
    weakSkills?: unknown;
  };
  rank?: {
    tier: string;
    stars: number;
    seasonId?: string | null;
    winCount: number;
    drawCount: number;
    loseCount: number;
    totalBattles: number;
  };
  wallet?: {
    address?: string | null;
    provider?: string | null;
    verifiedAt?: string | null;
  };
  brainPointBalance?: number;
}