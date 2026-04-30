import { Module } from '@nestjs/common';
import { OrdersController } from './controllers/orders.controller';
import { OrdersService } from './services/orders.service';
import { OrderMatchingService } from './services/order-matching.service';
import { TradingLedgerService } from './services/trading-ledger.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BalancesModule } from '../balances/balances.module';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
  imports: [BalancesModule, MarketDataModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderMatchingService,
    TradingLedgerService,
    PrismaService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
