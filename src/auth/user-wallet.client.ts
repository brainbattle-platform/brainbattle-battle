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
  chain?: string | null;
  isPrimary?: boolean;
}

function normalizeWalletResponse(userId: string, data: any): UserWalletInfo {
  const primary = data?.primaryWallet ?? data?.wallet ?? null;
  const walletAddress =
    data?.walletAddress ??
    data?.address ??
    primary?.walletAddress ??
    primary?.address ??
    null;

  return {
    userId: data?.userId ?? userId,
    walletAddress,
    walletVerifiedAt:
      data?.walletVerifiedAt ?? data?.verifiedAt ?? primary?.verifiedAt ?? null,
    walletProvider:
      data?.walletProvider ?? data?.chain ?? primary?.chain ?? null,
    chain: data?.chain ?? primary?.chain ?? data?.walletProvider ?? null,
    isPrimary: data?.isPrimary ?? primary?.isPrimary ?? Boolean(walletAddress),
  };
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

      return normalizeWalletResponse(userId, data);
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
