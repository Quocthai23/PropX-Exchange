import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TRADING_EVENTS } from '../orders/events/trading.events';
import type { OrderMatchedEvent } from '../orders/events/trading.events';
import { RealtimeGateway } from './realtime.gateway';
import { MarketDataGateway } from './market-data.gateway';
import { PrismaService } from '@/prisma/prisma.service';
import Decimal from 'decimal.js';

@Injectable()
export class TradingEventsListener {
  constructor(
    private readonly realtimeGateway: RealtimeGateway,
    private readonly marketDataGateway: MarketDataGateway,
    private readonly prisma: PrismaService,
  ) { }

  @OnEvent(TRADING_EVENTS.ORDER_MATCHED)
  async handleOrderMatched(event: OrderMatchedEvent): Promise<void> {
    this.realtimeGateway.emitTradeMatched({
      assetId: event.assetId,
      price: event.price,
      quantity: event.quantity,
      buyOrderId: event.buyOrderId,
      sellOrderId: event.sellOrderId,
      buyerUserId: event.buyerUserId,
      sellerUserId: event.sellerUserId,
      matchedAt: event.matchedAt.toISOString(),
    });

    await this.broadcastTicker(event.assetId);
  }

  private async broadcastTicker(assetId: string) {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const trades = await this.prisma.trade.findMany({
      where: {
        assetId,
        createdAt: {
          gte: twentyFourHoursAgo,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (trades.length === 0) {
      return;
    }

    const lastTrade = trades[0];
    const openTrade = trades[trades.length - 1];

    const high = Decimal.max(...trades.map((t) => t.price));
    const low = Decimal.min(...trades.map((t) => t.price));

    const volume = trades.reduce(
      (sum, t) => sum.add(t.quantity),
      new Decimal(0),
    );

    const buyVolume = trades
      .reduce((sum, t) => {
        // Assuming we can infer side from order IDs or some other mechanism if available
        // For now, let's assume a simple logic. This needs to be robust.
        // A better approach would be to have the side on the trade itself.
        return sum.add(t.quantity); // Placeholder
      }, new Decimal(0));

    const changePercent = openTrade.price.eq(0)
      ? 0
      : lastTrade.price.minus(openTrade.price).div(openTrade.price).toNumber() *
      100;

    const buyPercent = volume.eq(0)
      ? 50
      : buyVolume.div(volume).toNumber() * 100;

    this.marketDataGateway.emitTicker({
      assetId,
      ask: lastTrade.price.toNumber(), // Simplified: should be from order book
      bid: lastTrade.price.toNumber(), // Simplified: should be from order book
      changePercent,
      low: low.toNumber(),
      high: high.toNumber(),
      volume: volume.toNumber(),
      buyPercent,
      sellPercent: 100 - buyPercent,
      lastPrice: lastTrade.price.toNumber(),
      timestamp: now.toISOString(),
    });
  }
}
