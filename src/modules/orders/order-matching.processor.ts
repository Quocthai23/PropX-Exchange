import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import Decimal from 'decimal.js';


@Processor('order-matching', { concurrency: 1 })
export class OrderMatchingProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderMatchingProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ orderId: string }>) {
    this.logger.log(`Starting order matching for Order ID: ${job.data.orderId}`);
    
    try {

      await this.prisma.$transaction(async (tx) => {
        const incomingOrder = await tx.order.findUnique({ where: { id: job.data.orderId } });
        
        if (!incomingOrder || incomingOrder.status !== 'OPEN') {
          return;
        }


        const counterSide = incomingOrder.side === 'BUY' ? 'SELL' : 'BUY';
        
        const match = await tx.order.findFirst({
          where: {
            assetId: incomingOrder.assetId,
            side: counterSide,
            status: 'OPEN',

            price: incomingOrder.price, 
          },
          orderBy: { createdAt: 'asc' },
        });

        if (match) {
          this.logger.log(`Match found. Transaction between ${incomingOrder.id} and ${match.id}`);






          await tx.order.updateMany({
            where: { id: { in: [incomingOrder.id, match.id] } },
            data: { status: 'FILLED' }
          });
        } else {
          this.logger.log(`No counter-order found for ${incomingOrder.id}. Keeping it in the order book.`);
        }
      });
    } catch (error) {
      this.logger.error(`Error during order matching for ${job.data.orderId}:`, error);
      throw error;
    }
  }
}
