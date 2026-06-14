import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../common/env';

type RedisLike = Pick<Redis, 'disconnect' | 'get' | 'set' | 'del' | 'expire'>;

class DisabledRedisClient {
  async get() { return null; }
  async set() { return 'OK'; }
  async del() { return 0; }
  async expire() { return 0; }
  disconnect() { return undefined; }
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public readonly client: RedisLike;

  constructor() {
    if (!env.REDIS_ENABLED) {
      this.client = new DisabledRedisClient() as RedisLike;
      this.logger.log('Redis disabled. Using no-op Redis client for local demo.');
      return;
    }

    const client = env.REDIS_URL
      ? new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 })
      : new Redis({
          host: env.REDIS_HOST,
          port: env.REDIS_PORT,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableReadyCheck: false,
        });

    client.on('error', (error) => {
      this.logger.warn(`Redis unavailable: ${error.message}`);
    });

    this.client = client;
  }

  async onModuleDestroy() {
    this.client.disconnect();
  }
}
