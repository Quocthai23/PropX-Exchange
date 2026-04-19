import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MarketDataController } from './market-data.controller';
import { MarketDataService } from './market-data.service';
import { ExternalValuationService } from './external-valuation.service';

@Module({
  controllers: [MarketDataController],
  providers: [MarketDataService, ExternalValuationService, PrismaService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
