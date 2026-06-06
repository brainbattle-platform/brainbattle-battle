import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { env } from '../common/env';

export interface UserWalletInfo {
  userId: string;
  walletAddress: string | null;
  walletVerifiedAt?: string | null;
  walletProvider?: string | null;
}

@Injectable()
export class UserWalletClient {
  async getWallet(userId: string): Promise<UserWalletInfo> {
    if (!env.AUTH_WALLET_URL) {
      throw new ServiceUnavailableException('AUTH_WALLET_URL is not configured');
    }

    try {
      const { data } = await axios.get<UserWalletInfo>(
        `${env.AUTH_WALLET_URL}/${userId}/wallet`,
        {
          headers: {
            'x-internal-service-key': env.AUTH_INTERNAL_SERVICE_KEY,
          },
          timeout: env.AUTH_ME_TIMEOUT_MS,
        },
      );

      return {
        userId: data.userId,
        walletAddress: data.walletAddress ?? null,
        walletVerifiedAt: data.walletVerifiedAt ?? null,
        walletProvider: data.walletProvider ?? null,
      };
    } catch (error) {
      const axiosError = error as AxiosError;

      if (axiosError.response?.status === 404) {
        throw new NotFoundException(`Wallet not found for user ${userId}`);
      }

      throw new ServiceUnavailableException(
        'Auth wallet endpoint is unavailable',
      );
    }
  }
}