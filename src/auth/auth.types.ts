export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  roles?: string[];
  profile?: {
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
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
    avatar_url?: string | null;
    bio?: string | null;
    status?: string | null;
  } | null;
  learner_profile?: unknown | null;
}