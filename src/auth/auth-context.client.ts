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

      return {
        id: data.user_id,
        email: data.email,
        name: data.profile?.display_name ?? data.profile?.username ?? data.email,
        roles: data.roles ?? [],
        profile: data.profile ?? null,
        learnerProfile: data.learner_profile ?? null,
        raw: data,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;

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