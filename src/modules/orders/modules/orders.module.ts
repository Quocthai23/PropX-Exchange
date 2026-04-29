import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrdersService } from '../services/orders.service';
import { OrderMatchingService } from '../services/order-matching.service';
import { OrderMatchingProcessor } from '../processors/order-matching.processor';
import { PrismaService } from '../../../prisma/prisma.service';
import { BalancesModule } from '../../balances/balances.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'order-matching',
    }),
    BalancesModule,
  ],
  providers: [
    OrdersService,
    OrderMatchingService,
    OrderMatchingProcessor,
    PrismaService,
  ],
  exports: [OrdersService, OrderMatchingService],
})
export class OrdersModule {}
