import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { env } from '../common/env';
import { PublicUserProfile } from '../auth/auth.types';

@Injectable()
export class UserService {
  async getPublicProfile(userId: string): Promise<PublicUserProfile> {
    if (!env.USER_PUBLIC_PROFILE_URL) {
      throw new ServiceUnavailableException(
        'USER_PUBLIC_PROFILE_URL is not configured',
      );
    }

    try {
      const { data } = await axios.get<PublicUserProfile>(
        `${env.USER_PUBLIC_PROFILE_URL}/${userId}`,
        {
          headers: {
            'x-internal-service-key': env.AUTH_INTERNAL_SERVICE_KEY,
          },
          timeout: env.AUTH_ME_TIMEOUT_MS,
        },
      );

      return {
        userId: data.userId,
        email: data.email ?? null,
        username: data.username ?? null,
        displayName: data.displayName ?? data.username ?? null,
        avatarUrl: data.avatarUrl ?? null,
        status: data.status ?? null,
        learner: data.learner ?? {
          onboardingCompleted: false,
        },
        rank: data.rank ?? {
          tier: 'BRONZE',
          stars: 0,
          seasonId: null,
          winCount: 0,
          drawCount: 0,
          loseCount: 0,
          totalBattles: 0,
        },
        wallet: data.wallet ?? {
          address: null,
          provider: null,
          verifiedAt: null,
        },
        brainPointBalance: data.brainPointBalance ?? 0,
      };
    } catch (error) {
      const axiosError = error as AxiosError;

      if (axiosError.response?.status === 404) {
        throw new NotFoundException(`Public profile not found for ${userId}`);
      }

      throw new ServiceUnavailableException(
        'Auth public profile endpoint is unavailable',
      );
    }
  }
}