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

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class KlineGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(KlineGateway.name);

  emitKline(payload: KlineUpdatePayload): void {
    this.server.emit('kline', payload);
    this.logger.debug(
      `Emitted kline for asset=${payload.assetId} resolution=${payload.resolution} time=${payload.time}`,
    );
  }
}
