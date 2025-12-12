import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  client = new Redis(process.env.REDIS_URL!);
}
