import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma/prisma.service';
import { createClient } from 'redis';
import { AppConfigService } from '@/config/app-config.service';
import {
  KlineGateway,
  type KlineUpdatePayload,
} from '../gateways/kline.gateway';

type DecimalValue = string | number | { toString(): string };

const toDecimalValue = (value: DecimalValue): string | number =>
  typeof value === 'string' || typeof value === 'number'
    ? value
    : value.toString();

export interface CandlePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  value: number;
}

export interface ReferencePriceAnchor {
  assetId: string;
  referencePrice: number | null;
  valuationSnapshotPrice: number | null;
  marketPrice: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  midPrice: number | null;
  lastTradePrice: number | null;
  bandUpper: number | null;
  bandLower: number | null;
}

interface CandlestickRecord {
  openTime: Date;
  open: DecimalValue;
  high: DecimalValue;
  low: DecimalValue;
  close: DecimalValue;
  volume: DecimalValue;
}

interface MarketDataPrisma {
  candlestick: {
    findUnique(args: {
      where: {
        assetId_resolution_openTime: {
          assetId: string;
          resolution: string;
          openTime: Date;
        };
      };
    }): Promise<CandlestickRecord | null>;
    create(args: {
      data: {
        assetId: string;
        resolution: string;
        openTime: Date;
        open: DecimalValue;
        high: DecimalValue;
        low: DecimalValue;
        close: DecimalValue;
        volume: DecimalValue;
      };
    }): Promise<CandlestickRecord>;
    update(args: {
      where: {
        assetId_resolution_openTime: {
          assetId: string;
          resolution: string;
          openTime: Date;
        };
      };
      data: {
        high: DecimalValue;
        low: DecimalValue;
        close: DecimalValue;
        volume: DecimalValue;
      };
    }): Promise<CandlestickRecord>;
    upsert(args: {
      where: {
        assetId_resolution_openTime: {
          assetId: string;
          resolution: string;
          openTime: Date;
        };
      };
      update: {
        high: DecimalValue;
        low: DecimalValue;
        close: DecimalValue;
        volume: DecimalValue;
      };
      create: {
        assetId: string;
        resolution: string;
        openTime: Date;
        open: DecimalValue;
        high: DecimalValue;
        low: DecimalValue;
        close: DecimalValue;
        volume: DecimalValue;
      };
    }): Promise<CandlestickRecord>;
    findMany(args: {
      where: {
        assetId: string;
        resolution: string;
        openTime: { gte: Date; lte: Date };
      };
      orderBy: { openTime: 'asc' };
    }): Promise<CandlestickRecord[]>;
  };
}

@Injectable()
export class MarketDataService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketDataService.name);
  private redisClient: ReturnType<typeof createClient>;
  private readonly REDIS_TRADE_QUEUE = 'market_data:pending_trades';
  private readonly REDIS_OHLC_CACHE_PREFIX = 'market_data:ohlc:';
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly klineGateway: KlineGateway,
  ) {
    this.redisClient = createClient({
      url: this.config.redisUrl,
    });
    this.redisClient.on('error', (err) =>
      this.logger.error('Redis Client Error', err),
    );
  }

  async onModuleInit() {
    await this.redisClient.connect();
  }

  async onModuleDestroy() {
    await this.redisClient.disconnect();
  }

  async recordTrade(
    assetId: string,
    price: string,
    quantity: string,
    timestamp: Date,
  ): Promise<void> {
    const tradeData = JSON.stringify({
      assetId,
      price,
      quantity,
      timestamp: timestamp.toISOString(),
    });

    // Push trade to Redis queue for background DB sync
    await this.redisClient.rPush(this.REDIS_TRADE_QUEUE, tradeData);

    const resolutions = ['1m', '5m', '15m', '1h', '4h', '1d'];

    for (const resolution of resolutions) {
      const openTime = this.getOpenTimeForResolution(timestamp, resolution);
      const cacheKey = `${this.REDIS_OHLC_CACHE_PREFIX}${assetId}:${resolution}:${openTime.getTime()}`;

      const existingStr = await this.redisClient.get(cacheKey);
      let newOpen = price;
      let newHigh = price;
      let newLow = price;
      let newVolume = quantity;

      if (existingStr) {
        const existing = JSON.parse(existingStr) as {
          open: string;
          high: string;
          low: string;
          volume: string;
        };
        newOpen = existing.open;
        newHigh = Decimal.max(existing.high, price).toString();
        newLow = Decimal.min(existing.low, price).toString();
        newVolume = new Decimal(existing.volume).add(quantity).toString();
      }

      // Continue with updated values to cache and emit

      await this.redisClient.set(
        cacheKey,
        JSON.stringify({
          assetId,
          resolution,
          openTime: openTime.toISOString(),
          open: newOpen,
          high: newHigh,
          low: newLow,
          close: price,
          volume: newVolume,
        }),
        { EX: 86400 },
      );

      const emittedKline: KlineUpdatePayload = {
        assetId,
        resolution,
        time: Math.floor(openTime.getTime() / 1000),
        open: Number(newOpen),
        high: Number(newHigh),
        low: Number(newLow),
        close: Number(price),
        volume: Number(newVolume),
        isClosed: false,
      };

      this.klineGateway.emitKline(emittedKline);
    }
  }

  private getOpenTimeForResolution(timestamp: Date, resolution: string): Date {
    const openTime = new Date(timestamp);
    openTime.setSeconds(0, 0);
    const minutes = openTime.getMinutes();
    const hours = openTime.getHours();

    switch (resolution) {
      case '1m':
        break;
      case '5m':
        openTime.setMinutes(Math.floor(minutes / 5) * 5);
        break;
      case '15m':
        openTime.setMinutes(Math.floor(minutes / 15) * 15);
        break;
      case '1h':
        openTime.setMinutes(0);
        break;
      case '4h':
        openTime.setHours(Math.floor(hours / 4) * 4);
        openTime.setMinutes(0);
        break;
      case '1d':
        openTime.setHours(0);
        openTime.setMinutes(0);
        break;
    }

    return openTime;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async syncTradesToDB() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const queueLength = await this.redisClient.lLen(this.REDIS_TRADE_QUEUE);
      if (queueLength === 0) return;

      const tradesData = await this.redisClient.lPopCount(
        this.REDIS_TRADE_QUEUE,
        queueLength,
      );
      if (!tradesData || tradesData.length === 0) return;

      const prisma = this.prisma as unknown as MarketDataPrisma;

      // Group trades by assetId + resolution + openTime
      const groupedTrades: Record<
        string,
        {
          assetId: string;
          resolution: string;
          openTime: Date;
          open: string;
          high: string;
          low: string;
          close: string;
          volume: string;
        }
      > = {};

      const resolutions = ['1m', '5m', '15m', '1h', '4h', '1d'];

      for (const tradeStr of tradesData) {
        const trade = JSON.parse(tradeStr) as {
          assetId: string;
          price: string;
          quantity: string;
          timestamp: string;
        };
        const timestamp = new Date(trade.timestamp);

        for (const resolution of resolutions) {
          const openTime = this.getOpenTimeForResolution(timestamp, resolution);
          const groupKey = `${trade.assetId}_${resolution}_${openTime.getTime()}`;

          if (!groupedTrades[groupKey]) {
            groupedTrades[groupKey] = {
              assetId: trade.assetId,
              resolution,
              openTime,
              open: trade.price,
              high: trade.price,
              low: trade.price,
              close: trade.price,
              volume: trade.quantity,
            };
          } else {
            const current = groupedTrades[groupKey];
            current.high = Decimal.max(current.high, trade.price).toString();
            current.low = Decimal.min(current.low, trade.price).toString();
            current.close = trade.price;
            current.volume = new Decimal(current.volume)
              .add(trade.quantity)
              .toString();
          }
        }
      }

      for (const groupKey of Object.keys(groupedTrades)) {
        const group = groupedTrades[groupKey];
        const currentDb = await prisma.candlestick.findUnique({
          where: {
            assetId_resolution_openTime: {
              assetId: group.assetId,
              resolution: group.resolution,
              openTime: group.openTime,
            },
          },
        });

        if (!currentDb) {
          await prisma.candlestick.create({
            data: {
              assetId: group.assetId,
              resolution: group.resolution,
              openTime: group.openTime,
              open: group.open,
              high: group.high,
              low: group.low,
              close: group.close,
              volume: group.volume,
            },
          });
        } else {
          await prisma.candlestick.update({
            where: {
              assetId_resolution_openTime: {
                assetId: group.assetId,
                resolution: group.resolution,
                openTime: group.openTime,
              },
            },
            data: {
              high: Decimal.max(
                toDecimalValue(currentDb.high),
                group.high,
              ).toString(),
              low: Decimal.min(
                toDecimalValue(currentDb.low),
                group.low,
              ).toString(),
              close: group.close,
              volume: new Decimal(toDecimalValue(currentDb.volume))
                .add(group.volume)
                .toString(),
            },
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to sync trades to DB', error);
    } finally {
      this.isProcessing = false;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async generateDemoTrades() {
    if (!this.config.enableDemoMarketData) return;

    try {
      const assets = await this.prisma.asset.findMany({ select: { id: true } });
      const now = new Date();

      for (const a of assets) {
        const anchor = await this.getReferencePriceAnchor(a.id);
        const ref =
          anchor.referencePrice ??
          anchor.valuationSnapshotPrice ??
          anchor.marketPrice;
        if (!ref) continue;

        const fluctuation = (Math.random() * 2 - 1) * 0.01; // +/-1%
        const price = new Decimal(ref)
          .mul(new Decimal(1).plus(fluctuation))
          .toFixed(8);
        const quantity = new Decimal(Math.max(1, Math.random() * 5)).toFixed(8);

        await this.recordTrade(a.id, price, quantity, now);
      }
    } catch (error) {
      this.logger.error('Failed to generate demo trades', error);
    }
  }

  async getCandles(
    assetId: string,
    resolution: string,
    from: Date,
    to: Date,
  ): Promise<CandlePoint[]> {
    const prisma = this.prisma as unknown as MarketDataPrisma;

    const dbCandles = await prisma.candlestick.findMany({
      where: {
        assetId,
        resolution,
        openTime: { gte: from, lte: to },
      },
      orderBy: { openTime: 'asc' },
    });

    const results = dbCandles.map((c) => ({
      time: Math.floor(c.openTime.getTime() / 1000),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      value: Number(c.volume),
    }));

    // Supplement with latest from Redis cache if available
    const openTimeMs = this.getOpenTimeForResolution(new Date(), resolution);
    const cacheKey = `${this.REDIS_OHLC_CACHE_PREFIX}${assetId}:${resolution}:${openTimeMs.getTime()}`;
    const cachedStr = await this.redisClient.get(cacheKey);
    if (cachedStr) {
      const cached = JSON.parse(cachedStr) as {
        openTime: string;
        open: string;
        high: string;
        low: string;
        close: string;
        volume: string;
      };
      const cachedTime = Math.floor(new Date(cached.openTime).getTime() / 1000);

      const existingIdx = results.findIndex((r) => r.time === cachedTime);
      if (existingIdx !== -1) {
        results[existingIdx] = {
          time: cachedTime,
          open: Number(cached.open),
          high: Number(cached.high),
          low: Number(cached.low),
          close: Number(cached.close),
          value: Number(cached.volume),
        };
      } else {
        results.push({
          time: cachedTime,
          open: Number(cached.open),
          high: Number(cached.high),
          low: Number(cached.low),
          close: Number(cached.close),
          value: Number(cached.volume),
        });
      }
    }

    return results;
  }

  async getReferencePriceAnchor(
    assetId: string,
  ): Promise<ReferencePriceAnchor> {
    const [asset, bestBidOrder, bestAskOrder, latestValuation] =
      await Promise.all([
        this.prisma.asset.findUnique({
          where: { id: assetId },
          select: {
            id: true,
            tokenPrice: true,
            referencePrice: true,
            priceBandPercentage: true,
          },
        }),
        this.prisma.order.findFirst({
          where: {
            assetId,
            side: 'BUY',
            status: { in: ['OPEN', 'PARTIALLY_FILLED'] },
            price: { not: null },
          },
          orderBy: [{ price: 'desc' }, { createdAt: 'asc' }],
          select: { price: true },
        }),
        this.prisma.order.findFirst({
          where: {
            assetId,
            side: 'SELL',
            status: { in: ['OPEN', 'PARTIALLY_FILLED'] },
            price: { not: null },
          },
          orderBy: [{ price: 'asc' }, { createdAt: 'asc' }],
          select: { price: true },
        }),
        this.prisma.assetValuationSnapshot.findFirst({
          where: { assetId },
          orderBy: { capturedAt: 'desc' },
          select: { price: true },
        }),
      ]);

    if (!asset) {
      return {
        assetId,
        referencePrice: null,
        valuationSnapshotPrice: null,
        marketPrice: null,
        bestBid: null,
        bestAsk: null,
        midPrice: null,
        lastTradePrice: null,
        bandUpper: null,
        bandLower: null,
      };
    }

    const configuredReferencePrice = asset.referencePrice
      ? new Decimal(asset.referencePrice.toString())
      : null;
    const snapshotReferencePrice =
      latestValuation?.price !== undefined && latestValuation?.price !== null
        ? new Decimal(latestValuation.price.toString())
        : null;
    const effectiveReferencePrice =
      configuredReferencePrice ?? snapshotReferencePrice;

    const bestBid =
      bestBidOrder?.price !== null && bestBidOrder?.price !== undefined
        ? new Decimal(bestBidOrder.price.toString())
        : null;
    const bestAsk =
      bestAskOrder?.price !== null && bestAskOrder?.price !== undefined
        ? new Decimal(bestAskOrder.price.toString())
        : null;
    const midPrice = bestBid && bestAsk ? bestBid.plus(bestAsk).div(2) : null;
    const lastTradePrice = asset.tokenPrice
      ? new Decimal(asset.tokenPrice.toString())
      : null;
    const marketPrice = midPrice ?? lastTradePrice;

    const band = new Decimal(asset.priceBandPercentage.toString());
    const bandUpper = effectiveReferencePrice
      ? effectiveReferencePrice.mul(new Decimal(1).plus(band))
      : null;
    const bandLower = effectiveReferencePrice
      ? effectiveReferencePrice.mul(new Decimal(1).minus(band))
      : null;

    return {
      assetId: asset.id,
      marketPrice: marketPrice ? Number(marketPrice) : null,
      referencePrice: configuredReferencePrice
        ? Number(configuredReferencePrice)
        : null,
      valuationSnapshotPrice: snapshotReferencePrice
        ? Number(snapshotReferencePrice)
        : null,
      bestBid: bestBid ? Number(bestBid) : null,
      bestAsk: bestAsk ? Number(bestAsk) : null,
      midPrice: midPrice ? Number(midPrice) : null,
      lastTradePrice: lastTradePrice ? Number(lastTradePrice) : null,
      bandUpper: bandUpper ? Number(bandUpper) : null,
      bandLower: bandLower ? Number(bandLower) : null,
    };
  }
}
