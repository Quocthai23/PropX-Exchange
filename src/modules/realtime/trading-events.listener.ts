import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TRADING_EVENTS } from '../orders/events/trading.events';
import type { OrderMatchedEvent } from '../orders/events/trading.events';
import { RealtimeGateway } from './realtime.gateway';
import { MarketDataGateway } from '../market-data/gateways/market-data.gateway';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class TradingEventsListener {
  constructor(
    private readonly realtimeGateway: RealtimeGateway,
    private readonly marketDataGateway: MarketDataGateway,
    private readonly prisma: PrismaService,
  ) {}

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
  }
}
