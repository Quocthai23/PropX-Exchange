import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrderMatchedEvent, TRADING_EVENTS } from '../events/trading.events';

@Processor('order-matching', { concurrency: 1 })
export class OrderMatchingProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderMatchingProcessor.name);

  constructor(
    private prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<{ orderId: string }>) {
    this.logger.log(
      `Starting order matching for Order ID: ${job.data.orderId}`,
    );

    try {
      let matchedEvent: OrderMatchedEvent | null = null;

      await this.prisma.$transaction(async (tx) => {
        const incomingOrder = await tx.order.findUnique({
          where: { id: job.data.orderId },
        });

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
          this.logger.log(
            `Match found. Transaction between ${incomingOrder.id} and ${match.id}`,
          );

          const matchedAt = new Date();
          const matchQuantity = Decimal.min(
            new Decimal(incomingOrder.quantity),
            new Decimal(match.quantity),
          ).toString();

          const isIncomingBuy = incomingOrder.side === 'BUY';
          const buyOrder = isIncomingBuy ? incomingOrder : match;
          const sellOrder = isIncomingBuy ? match : incomingOrder;

          await tx.order.updateMany({
            where: { id: { in: [incomingOrder.id, match.id] } },
            data: { status: 'FILLED' },
          });

          matchedEvent = {
            assetId: incomingOrder.assetId,
            price: incomingOrder.price?.toString() ?? '0',
            quantity: matchQuantity,
            buyOrderId: buyOrder.id,
            sellOrderId: sellOrder.id,
            buyerUserId: buyOrder.userId,
            sellerUserId: sellOrder.userId,
            matchedAt,
          };
        } else {
          this.logger.log(
            `No counter-order found for ${incomingOrder.id}. Keeping it in the order book.`,
          );
        }
      });

      if (matchedEvent) {
        this.eventEmitter.emit(TRADING_EVENTS.ORDER_MATCHED, matchedEvent);
      }
    } catch (error) {
      this.logger.error(
        `Error during order matching for ${job.data.orderId}:`,
        error,
      );
      throw error;
    }
  }
}
