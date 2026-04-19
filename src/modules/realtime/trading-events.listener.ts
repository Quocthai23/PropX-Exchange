import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TRADING_EVENTS } from '../orders/events/trading.events';
import type { OrderMatchedEvent } from '../orders/events/trading.events';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class TradingEventsListener {
  constructor(private readonly realtimeGateway: RealtimeGateway) {}

  @OnEvent(TRADING_EVENTS.ORDER_MATCHED)
  handleOrderMatched(event: OrderMatchedEvent): void {
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
