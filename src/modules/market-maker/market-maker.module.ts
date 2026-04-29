import { Module } from '@nestjs/common';
import { MarketMakerService } from './market-maker.service';
import { PrismaService } from '@/prisma/prisma.service';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
  imports: [MarketDataModule],
  providers: [MarketMakerService, PrismaService],
})
export class MarketMakerModule {}
