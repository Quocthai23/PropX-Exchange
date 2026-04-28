import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { MarketDataService } from '../market-data/services/market-data.service';
import Decimal from 'decimal.js';

type DecimalValue = string | number | { toString(): string };

const toDecimalValue = (value: DecimalValue): string | number =>
  typeof value === 'string' || typeof value === 'number'
    ? value
    : value.toString();

type MarketAsset = {
  id: string;
  symbol: string;
  tokenPrice: DecimalValue;
};

type MarketCandle = {
  close: DecimalValue;
};

type MarketMakerPrisma = {
  asset: {
    findMany(args: { where: { isActive: true } }): Promise<MarketAsset[]>;
  };
  candlestick: {
    findFirst(args: {
      where: { assetId: string; resolution: '1m' };
      orderBy: { openTime: 'desc' };
    }): Promise<MarketCandle | null>;
  };
  order: {
    createMany(args: {
      data: Array<{
        userId: string;
        assetId: string;
        side: string;
        type: string;
        price: Decimal;
        quantity: Decimal;
        filledQuantity: Decimal;
        status: string;
      }>;
    }): Promise<unknown>;
  };
};

@Injectable()
export class MarketMakerService {
  private readonly logger = new Logger(MarketMakerService.name);

  // Dummy user ID representing the bot (won't hit foreign key constraints because Order does not strictly map userId).
  private readonly BOT_USER_ID = '00000000-0000-0000-0000-000000000000';

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketDataService: MarketDataService,
  ) {}

  // Run every 30 seconds.
  @Cron('*/30 * * * * *')
  async simulateTrades() {
    // Use environment variable to enable/disable the bot and avoid unnecessary DB noise.
    if (process.env.ENABLE_MARKET_MAKER !== 'true') return;

    const prisma = this.prisma as unknown as MarketMakerPrisma;

    // Fetch all active RWA assets.
    const assets = await prisma.asset.findMany({
      where: { isActive: true },
    });

    for (const asset of assets) {
      try {
        // 1. Find the latest close price as the reference.
        const lastCandle = await prisma.candlestick.findFirst({
          where: { assetId: asset.id, resolution: '1m' },
          orderBy: { openTime: 'desc' },
        });

        // If no candle exists yet, use ICO price (tokenPrice) as baseline.
        const currentPrice = lastCandle
          ? new Decimal(toDecimalValue(lastCandle.close))
          : new Decimal(toDecimalValue(asset.tokenPrice));

        // 2. Random walk algorithm (max 1% volatility every 30s).
        const maxVolatility = 0.01;
        const randomFactor = (Math.random() * 2 - 1) * maxVolatility; // Random from -1% to +1%

        let newPrice = currentPrice.mul(1 + randomFactor).toDecimalPlaces(4);

        // Ensure price never falls to <= 0.
        if (newPrice.lte(0)) {
          newPrice = new Decimal(toDecimalValue(asset.tokenPrice));
        }

        // 3. Generate random matched quantity (for example, 1 to 50 tokens).
        const quantity = new Decimal(Math.floor(Math.random() * 50) + 1);

        // 4. Store synthetic trades in the Order table (to appear in Trade History).
        await prisma.order.createMany({
          data: [
            {
              userId: this.BOT_USER_ID,
              assetId: asset.id,
              side: 'BUY',
              type: 'MARKET',
              price: newPrice,
              quantity: quantity,
              filledQuantity: quantity,
              status: 'FILLED',
            },
            {
              userId: this.BOT_USER_ID,
              assetId: asset.id,
              side: 'SELL',
              type: 'MARKET',
              price: newPrice,
              quantity: quantity,
              filledQuantity: quantity,
              status: 'FILLED',
            },
          ],
        });

        // 5. Push values to MarketDataService for immediate OHLC candle updates.
        await this.marketDataService.recordTrade(
          asset.id,
          newPrice.toString(),
          quantity.toString(),
          new Date(),
        );

        this.logger.debug(
          `[Market Maker] Generated candle for ${asset.symbol}: Price ${newPrice.toString()} | Volume ${quantity.toString()}`,
        );
      } catch (error) {
        this.logger.error(
          `[Market Maker] Failed to generate data for ${asset.symbol}`,
          error,
        );
      }
    }
  }
}
