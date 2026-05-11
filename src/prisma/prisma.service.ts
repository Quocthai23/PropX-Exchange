import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// If this import fails, run: npx prisma generate
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { AppConfigService } from '../config/app-config.service';

/**
 * Note: If you see an error here, ensure you have run 'npx prisma generate'
 */

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly config: AppConfigService) {
    const datasourceUrl = config.databaseUrl;

    if (!datasourceUrl) {
      throw new Error('DATABASE_URL is required');
    }

    // allow overriding pool max via env DATABASE_POOL_MAX
    const poolMax = Number(process.env.DATABASE_POOL_MAX ?? '10');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const adapter = new PrismaMariaDb(datasourceUrl, {
      connectionLimit: poolMax,
    } as any);

    // Ensure a single PrismaClient instance per process (helps during dev hot-reload)
    const g = global as any;
    if (g.__prisma) {
      return g.__prisma;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    super({ adapter } as any);
    g.__prisma = this;
  }

  async onModuleInit(): Promise<void> {
    // PrismaClient methods are strongly typed; this suppresses a false positive when ESLint cannot resolve PnP types.

    const maxRetries = Number(process.env.PRISMA_CONNECT_RETRIES ?? '5');
    let lastErr: any;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        await super.$connect();
        return;
      } catch (err) {
        lastErr = err;
        const backoff = 500 * Math.pow(2, i);
        // If we've exhausted retries, rethrow
        if (i === maxRetries) throw lastErr;
        // wait and retry

        await new Promise((res) => setTimeout(res, backoff));
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await super.$disconnect();
  }
}
