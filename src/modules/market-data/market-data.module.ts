import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MarketDataController } from './controllers/market-data.controller';
import { MarketDataService } from './services/market-data.service';
import { ExternalValuationService } from './services/external-valuation.service';
import { KlineGateway } from './gateways/kline.gateway';

@Module({
  controllers: [MarketDataController],
  providers: [
    MarketDataService,
    ExternalValuationService,
    PrismaService,
    KlineGateway,
  ],
  exports: [MarketDataService],
})
export class MarketDataModule {}
