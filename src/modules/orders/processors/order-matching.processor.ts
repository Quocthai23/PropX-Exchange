import { Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { OrderMatchingService } from '../services/order-matching.service';

type OrderSide = 'BUY' | 'SELL';

interface OrderMatchingJobData {
  orderId: string;
  userId: string;
  assetId: string;
  side: OrderSide;
  price: string;
  quantity: string;
}

@Processor('order-matching')
export class OrderMatchingProcessor {
  private readonly logger = new Logger(OrderMatchingProcessor.name);

  constructor(private readonly orderMatchingService: OrderMatchingService) {}

  @Process('match')
  async handleOrderMatching(job: Job<OrderMatchingJobData>) {
    try {
      this.logger.log(
        `[Order Matching Job ${job.id}] Processing order ${job.data.orderId}`,
      );

      const result = await this.orderMatchingService.matchOrder(job.data);

      this.logger.log(
        `[Order Matching Job ${job.id}] Completed with ${result.matched} matches`,
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `[Order Matching Job ${job.id}] Failed: ${errorMessage}`,
        error,
      );
      throw error;
    }
  }
}
