import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../common/env';

@Injectable()
export class RedisService implements OnModuleDestroy {
  public readonly client: Redis;

  constructor() {
    if (env.REDIS_URL) {
      this.client = new Redis(env.REDIS_URL);
      return;
    }

    this.client = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
    });
  }

  async onModuleDestroy() {
    this.client.disconnect();
  }
}