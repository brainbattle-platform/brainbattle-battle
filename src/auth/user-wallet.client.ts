import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
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

    const { data } = await axios.get<UserWalletInfo>(
      `${env.AUTH_WALLET_URL}/${userId}/wallet`,
      {
        headers: {
          'x-internal-service-key': env.AUTH_INTERNAL_SERVICE_KEY,
        },
        timeout: env.AUTH_ME_TIMEOUT_MS,
      },
    );

    return data;
  }
}