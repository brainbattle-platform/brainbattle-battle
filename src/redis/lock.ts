import { randomUUID } from 'crypto';
import Redis from 'ioredis';

export async function acquireLock(redis: Redis, key: string, ttl: number) {
  const token = randomUUID();
  const ok = await redis.set(key, token, 'PX', ttl, 'NX');
  return ok === 'OK' ? { key, token } : null;
}

export async function releaseLock(redis: Redis, lock: any) {
  await redis.eval(
    `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) end`,
    1,
    lock.key,
    lock.token,
  );
}
