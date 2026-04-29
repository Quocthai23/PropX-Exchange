import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MarketDataController } from './controllers/market-data.controller';
import { MarketDataService } from './services/market-data.service';
import { ExternalValuationService } from './services/external-valuation.service';

@Module({
  controllers: [MarketDataController],
  providers: [MarketDataService, ExternalValuationService, PrismaService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
