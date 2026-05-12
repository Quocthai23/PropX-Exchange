import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { TradingEventsListener } from './trading-events.listener';
import { MarketDataGateway } from './market-data.gateway';
import { PrismaService } from '@/prisma/prisma.service';

@Module({
  providers: [
    RealtimeGateway,
    TradingEventsListener,
    MarketDataGateway,
    PrismaService,
  ],
  exports: [RealtimeGateway, MarketDataGateway],
})
export class RealtimeModule {}
