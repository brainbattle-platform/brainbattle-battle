import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  public readonly client: Redis;

  constructor() {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error('REDIS_URL is not defined');
    this.client = new Redis(url);
  }
}
