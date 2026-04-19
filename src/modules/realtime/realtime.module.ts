import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { TradingEventsListener } from './trading-events.listener';

@Module({
  providers: [RealtimeGateway, TradingEventsListener],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
