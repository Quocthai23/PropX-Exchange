import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

type MarketSubscriptionPayload = {
  assetId: string;
};

type UserSubscriptionPayload = {
  userId: string;
};

type TradeRealtimePayload = {
  assetId: string;
  price: string;
  quantity: string;
  buyOrderId: string;
  sellOrderId: string;
  buyerUserId: string;
  sellerUserId: string;
  matchedAt: string;
};

type UserTradeNotification = {
  side: 'BUY' | 'SELL';
  orderId: string;
  assetId: string;
  price: string;
  quantity: string;
  matchedAt: string;
};

type PriceUpdatePayload = {
  assetId: string;
  price: string;
  quantity: string;
  timestamp: string;
};

@WebSocketGateway({
  namespace: 'trading',
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe_market')
  async subscribeMarket(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MarketSubscriptionPayload,
  ): Promise<void> {
    if (!payload?.assetId) {
      return;
    }

    await client.join(this.marketRoom(payload.assetId));
  }

  @SubscribeMessage('unsubscribe_market')
  async unsubscribeMarket(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MarketSubscriptionPayload,
  ): Promise<void> {
    if (!payload?.assetId) {
      return;
    }

    await client.leave(this.marketRoom(payload.assetId));
  }

  @SubscribeMessage('subscribe_user')
  async subscribeUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: UserSubscriptionPayload,
  ): Promise<void> {
    if (!payload?.userId) {
      return;
    }

    await client.join(this.userRoom(payload.userId));
  }

  emitTradeMatched(payload: TradeRealtimePayload): void {
    this.server
      .to(this.marketRoom(payload.assetId))
      .emit('trade_matched', payload);

    const priceUpdate: PriceUpdatePayload = {
      assetId: payload.assetId,
      price: payload.price,
      quantity: payload.quantity,
      timestamp: payload.matchedAt,
    };

    this.server
      .to(this.marketRoom(payload.assetId))
      .emit('price_update', priceUpdate);

    this.server.to(this.marketRoom(payload.assetId)).emit('order_book_update', {
      assetId: payload.assetId,
      timestamp: payload.matchedAt,
    });

    const buyerNotification: UserTradeNotification = {
      side: 'BUY',
      orderId: payload.buyOrderId,
      assetId: payload.assetId,
      price: payload.price,
      quantity: payload.quantity,
      matchedAt: payload.matchedAt,
    };

    const sellerNotification: UserTradeNotification = {
      side: 'SELL',
      orderId: payload.sellOrderId,
      assetId: payload.assetId,
      price: payload.price,
      quantity: payload.quantity,
      matchedAt: payload.matchedAt,
    };

    this.server
      .to(this.userRoom(payload.buyerUserId))
      .emit('my_order_matched', buyerNotification);

    this.server
      .to(this.userRoom(payload.sellerUserId))
      .emit('my_order_matched', sellerNotification);
  }

  private marketRoom(assetId: string): string {
    return `asset:${assetId}`;
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }
}
