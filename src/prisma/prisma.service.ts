import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// If this import fails, run: npx prisma generate
import { PrismaClient } from '@prisma/client';

/**
 * Note: If you see an error here, ensure you have run 'npx prisma generate'
 */

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    // PrismaClient methods are strongly typed; this suppresses a false positive when ESLint cannot resolve PnP types.

    await super.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await super.$disconnect();
  }
}
