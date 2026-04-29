import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma/prisma.service';

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
export class MarketDataService {
  constructor(private readonly prisma: PrismaService) {}

  async recordTrade(
    assetId: string,
    price: string,
    quantity: string,
    timestamp: Date,
  ): Promise<CandlestickRecord> {
    const openTime = new Date(timestamp);
    openTime.setSeconds(0, 0);

    const prisma = this.prisma as unknown as MarketDataPrisma;

    const current = await prisma.candlestick.findUnique({
      where: {
        assetId_resolution_openTime: {
          assetId,
          resolution: '1m',
          openTime,
        },
      },
    });

    if (!current) {
      return prisma.candlestick.create({
        data: {
          assetId,
          resolution: '1m',
          openTime,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: quantity,
        },
      });
    }

    const nextHigh = Decimal.max(
      toDecimalValue(current.high),
      price,
    ).toString();
    const nextLow = Decimal.min(toDecimalValue(current.low), price).toString();
    const nextVolume = new Decimal(toDecimalValue(current.volume))
      .add(quantity)
      .toString();

    return prisma.candlestick.update({
      where: {
        assetId_resolution_openTime: {
          assetId,
          resolution: '1m',
          openTime,
        },
      },
      data: {
        high: nextHigh,
        low: nextLow,
        close: price,
        volume: nextVolume,
      },
    });
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

    return dbCandles.map((c) => ({
      time: Math.floor(c.openTime.getTime() / 1000),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      value: Number(c.volume),
    }));
  }

  async getReferencePriceAnchor(assetId: string): Promise<ReferencePriceAnchor> {
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
    const midPrice =
      bestBid && bestAsk ? bestBid.plus(bestAsk).div(2) : null;
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
