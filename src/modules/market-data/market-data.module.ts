import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MarketDataController } from './controllers/market-data.controller';
import { MarketDataService } from './services/market-data.service';
import { ExternalValuationService } from './services/external-valuation.service';
import { MarketDataGateway } from './gateways/market-data.gateway';

@Module({
  controllers: [MarketDataController],
  providers: [
    MarketDataService,
    ExternalValuationService,
    PrismaService,
    MarketDataGateway,
  ],
  exports: [MarketDataService, MarketDataGateway],
})
export class MarketDataModule {}
