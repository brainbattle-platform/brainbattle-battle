import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { env } from '../common/env';

export interface AuthRankSyncPayload {
  userId: string;
  rankTier: string;
  stars: number;
  seasonId: string;
  winCount: number;
  drawCount: number;
  loseCount: number;
  totalBattles: number;
  brainPointBalance: number;
}

@Injectable()
export class AuthProfileSyncClient {
  private readonly logger = new Logger(AuthProfileSyncClient.name);

  async syncRankProfile(payload: AuthRankSyncPayload) {
    if (!env.AUTH_PROFILE_SYNC_ENABLED) {
      return { skipped: true, reason: 'AUTH_PROFILE_SYNC_DISABLED' };
    }

    if (!env.AUTH_PROFILE_SYNC_URL) {
      return { skipped: true, reason: 'AUTH_PROFILE_SYNC_URL_NOT_CONFIGURED' };
    }

    try {
      const { data } = await axios.patch(env.AUTH_PROFILE_SYNC_URL, payload, {
        headers: {
          'x-internal-service-key': env.AUTH_INTERNAL_SERVICE_KEY,
        },
        timeout: env.AUTH_ME_TIMEOUT_MS,
      });

      return {
        synced: true,
        response: data,
      };
    } catch (error) {
      const axiosError = error as AxiosError;

      this.logger.warn(
        `Failed to sync rank profile for user ${payload.userId}. Status: ${
          axiosError.response?.status ?? 'NO_STATUS'
        }`,
      );

      return {
        synced: false,
        status: axiosError.response?.status ?? null,
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      };
    }
  }
}