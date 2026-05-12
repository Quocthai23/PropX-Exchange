import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

export interface TickerPayload {
    assetId: string;
    ask: number; // Buy Price
    bid: number; // Sell Price
    changePercent: number; // Chg %
    low: number;
    high: number;
    volume: number;
    buyPercent: number;
    sellPercent: number;
    lastPrice: number;
    timestamp: string;
}

@WebSocketGateway({
    namespace: '/',
    cors: {
        origin: '*',
    },
})
export class MarketDataGateway
    implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    private readonly logger = new Logger(MarketDataGateway.name);

    handleConnection(client: Socket): void {
        this.logger.debug(`Client connected to market data: ${client.id}`);
    }

    handleDisconnect(client: Socket): void {
        this.logger.debug(`Client disconnected from market data: ${client.id}`);
    }

    emitTicker(payload: TickerPayload): void {
        this.server.emit(`ticker`, payload);
    }
}
