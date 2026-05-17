import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { TradingEventsListener } from './trading-events.listener';
import { PrismaService } from '@/prisma/prisma.service';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
  imports: [MarketDataModule],
  providers: [RealtimeGateway, TradingEventsListener, PrismaService],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
