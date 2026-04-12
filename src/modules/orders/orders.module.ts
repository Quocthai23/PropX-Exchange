import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrderMatchingService } from './services/order-matching.service';
import { OrderMatchingProcessor } from './processors/order-matching.processor';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'order-matching',
    }),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderMatchingService,
    OrderMatchingProcessor,
    PrismaService,
  ],
})
export class OrdersModule {}
