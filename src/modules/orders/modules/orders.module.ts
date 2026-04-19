import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrdersService } from '../services/orders.service';
import { OrderMatchingProcessor } from '../processors/order-matching.processor';
import { PrismaService } from '../../../prisma/prisma.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'order-matching',
    }),
  ],
  providers: [OrdersService, OrderMatchingProcessor, PrismaService],
  exports: [OrdersService],
})
export class OrdersModule {}
