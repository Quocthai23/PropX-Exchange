import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// If this import fails, run: npx prisma generate
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

/**
 * Note: If you see an error here, ensure you have run 'npx prisma generate'
 */

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const datasourceUrl = process.env.DATABASE_URL;

    if (!datasourceUrl) {
      throw new Error('DATABASE_URL is required');
    }

    const adapter = new PrismaMariaDb(datasourceUrl);

    super({
      adapter,
    });
  }

  async onModuleInit(): Promise<void> {
    // PrismaClient methods are strongly typed; this suppresses a false positive when ESLint cannot resolve PnP types.

    await super.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await super.$disconnect();
  }
}
