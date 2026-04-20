import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';

type AssetListItem = {
  id: string;
  symbol: string;
};

type AssetDailyPriceDelegate = {
  findMany(args: {
    where: {
      isActive: boolean;
      tradingStatus: string;
    };
    select: {
      id: true;
      symbol: true;
    };
  }): Promise<AssetListItem[]>;
  update(args: {
    where: { id: string };
    data: { referencePrice: unknown };
  }): Promise<unknown>;
};

@Injectable()
export class DailyPriceCron {
  private readonly logger = new Logger(DailyPriceCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async updateReferencePrices() {
    this.logger.log('Starting daily reference price update...');

    const prisma = this.prisma as PrismaService & {
      asset: AssetDailyPriceDelegate;
    };

    const assets = await prisma.asset.findMany({
      where: {
        isActive: true,
        tradingStatus: 'OPEN',
      },
      select: { id: true, symbol: true },
    });

    for (const asset of assets) {
      const lastDailyCandle = await this.prisma.candlestick.findFirst({
        where: {
          assetId: asset.id,
          resolution: '1d',
        },
        orderBy: { openTime: 'desc' },
        select: { close: true },
      });

      if (!lastDailyCandle) {
        continue;
      }

      await prisma.asset.update({
        where: { id: asset.id },
        data: { referencePrice: lastDailyCandle.close },
      });

      this.logger.debug(
        `Updated reference price for ${asset.symbol} to ${lastDailyCandle.close.toString()}`,
      );
    }
  }
}
