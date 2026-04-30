import { Module } from '@nestjs/common';
import { MarketMakerService } from './market-maker.service';
import { PrismaService } from '@/prisma/prisma.service';
import { MarketDataModule } from '../market-data/market-data.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [MarketDataModule, OrdersModule],
  providers: [MarketMakerService, PrismaService],
})
export class MarketMakerModule {}
