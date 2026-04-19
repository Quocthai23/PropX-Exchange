import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MarketDataController } from './market-data.controller';
import { MarketDataService } from './market-data.service';

@Module({
  controllers: [MarketDataController],
  providers: [MarketDataService, PrismaService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
