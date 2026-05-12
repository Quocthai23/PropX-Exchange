import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

export interface KlineUpdatePayload {
  assetId: string;
  resolution: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
}

export interface TickerUpdatePayload {
  symbol: string;
  assetId?: string;
  ask: number | null;
  bid: number | null;
  lastPrice: number | null;
  change: number;
  changePercent: number;
  high: number | null;
  low: number | null;
  volume: number;
  quoteVolume: number;
  buyPercent?: number;
  sellPercent?: number;
  spread?: number;
  timestamp?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MarketDataGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MarketDataGateway.name);

  emitKline(payload: KlineUpdatePayload): void {
    this.server.emit('kline', payload);
    this.logger.debug(
      `Emitted kline for asset=${payload.assetId} resolution=${payload.resolution} time=${payload.time}`,
    );
  }

  emitTicker(payload: TickerUpdatePayload): void {
    this.server.emit('ticker', payload);
    this.logger.debug(`Emitted ticker for symbol=${payload.symbol}`);
  }
}
