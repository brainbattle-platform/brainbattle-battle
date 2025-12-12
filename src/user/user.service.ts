import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { env } from '../common/env';

@Injectable()
export class UserService {
  async getPublicProfile(userId: string) {
    // Fallback local/dev
    if (!env.USER_PUBLIC_PROFILE_URL) {
      return {
        userId,
        username: `user_${userId.slice(0, 6)}`,
      };
    }

    const { data } = await axios.get(
      `${env.USER_PUBLIC_PROFILE_URL}/${userId}`,
    );

    return {
      userId,
      username: data.username,
      avatar: data.avatar,
    };
  }
}
