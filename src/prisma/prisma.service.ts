import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      // Supabase/PostgreSQL can be slow to allocate an interactive transaction
      // connection on first requests. The defaults are too aggressive for demo
      // devices and caused P2028 on shop inventory.
      transactionOptions: {
        maxWait: 10_000,
        timeout: 20_000,
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
