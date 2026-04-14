import type Redis from 'ioredis';
import { randomUUID } from 'crypto';

export async function acquireLock(client: Redis, key: string, ttlMs: number) {
  const token = randomUUID();
  const ok = await client.set(key, token, 'PX', ttlMs, 'NX');
  return ok ? token : null;
}

export async function releaseLock(client: Redis, key: string, token: string) {
  // release only if token matches
  const lua = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;
  await client.eval(lua, 1, key, token);
}
