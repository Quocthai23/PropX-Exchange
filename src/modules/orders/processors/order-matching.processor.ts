import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderMatchingService } from '../services/order-matching.service';

@Processor('order-matching', { concurrency: 1 })
export class OrderMatchingProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderMatchingProcessor.name);

  constructor(private readonly orderMatchingService: OrderMatchingService) {
    super();
  }

  async process(job: Job<{ orderId: string }>) {
    this.logger.log(
      `Starting order matching for Order ID: ${job.data.orderId}`,
    );

    try {
      await this.orderMatchingService.matchOrder({ orderId: job.data.orderId });
    } catch (error) {
      this.logger.error(
        `Error during order matching for ${job.data.orderId}:`,
        error,
      );
      throw error;
    }
  }
}
