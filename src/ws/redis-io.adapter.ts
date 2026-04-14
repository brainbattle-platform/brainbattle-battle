import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { ServerOptions } from 'socket.io';
import type { Redis } from 'ioredis';

export class RedisIoAdapter extends IoAdapter {
  constructor(app: any, private readonly pub: Redis, private readonly sub: Redis) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    server.adapter(createAdapter(this.pub as any, this.sub as any));
    return server;
  }
}
