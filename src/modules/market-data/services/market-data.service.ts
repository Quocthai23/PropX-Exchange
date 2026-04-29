import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../prisma/prisma.service';

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
}
