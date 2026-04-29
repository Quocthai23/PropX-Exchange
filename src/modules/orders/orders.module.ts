import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrdersController } from './controllers/orders.controller';
import { OrdersService } from './services/orders.service';
import { OrderMatchingService } from './services/order-matching.service';
import { TradingLedgerService } from './services/trading-ledger.service';
import { OrderMatchingProcessor } from './processors/order-matching.processor';
import { PrismaService } from '@/prisma/prisma.service';
import { BalancesModule } from '../balances/balances.module';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'order-matching',
    }),
    BalancesModule,
    MarketDataModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderMatchingService,
    TradingLedgerService,
    OrderMatchingProcessor,
    PrismaService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
