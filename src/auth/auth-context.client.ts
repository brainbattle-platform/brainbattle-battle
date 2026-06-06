import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { env } from '../common/env';
import { AuthContextMeResponse, AuthUser } from './auth.types';

@Injectable()
export class AuthContextClient {
  async verifyBearerToken(token: string): Promise<AuthUser> {
    if (!env.AUTH_ME_URL) {
      throw new ServiceUnavailableException('AUTH_ME_URL is not configured');
    }

    try {
      const { data } = await axios.get<AuthContextMeResponse>(env.AUTH_ME_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: env.AUTH_ME_TIMEOUT_MS,
      });

      if (!data?.user_id) {
        throw new UnauthorizedException('Invalid auth context response');
      }

      const profile = data.profile ?? null;

      const displayName =
        profile?.displayName ??
        profile?.display_name ??
        profile?.username ??
        data.email;

      return {
        id: data.user_id,
        email: data.email,
        name: displayName ?? data.user_id,
        roles: data.roles ?? [],
        profile: profile
          ? {
              username: profile.username ?? null,
              displayName:
                profile.displayName ?? profile.display_name ?? null,
              avatarUrl: profile.avatarUrl ?? profile.avatar_url ?? null,
              bio: profile.bio ?? null,
              status: profile.status ?? null,
            }
          : null,
        learnerProfile: data.learnerProfile ?? data.learner_profile ?? null,
        raw: data,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      const axiosError = error as AxiosError;

      if (
        axiosError.response?.status === 401 ||
        axiosError.response?.status === 403
      ) {
        throw new UnauthorizedException('Invalid or expired bearer token');
      }

      throw new ServiceUnavailableException('Auth service is unavailable');
    }
  }
}