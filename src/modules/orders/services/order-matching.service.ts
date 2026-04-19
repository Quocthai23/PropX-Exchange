import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../prisma/prisma.service';

type OrderSide = 'BUY' | 'SELL';
type OrderStatus = 'OPEN' | 'PARTIAL' | 'FILLED' | 'CANCELLED';

interface OrderMatchingJobData {
  orderId: string;
  userId: string;
  assetId: string;
  side: OrderSide;
  price: string;
  quantity: string;
}

@Injectable()
export class OrderMatchingService {
  private readonly logger = new Logger(OrderMatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('order-matching') private orderMatchingQueue: Queue,
  ) {}

  /**
   * Queue a new order for matching
   * This prevents deadlocks by processing orders serially via queue
   */
  async queueOrder(
    orderId: string,
    userId: string,
    assetId: string,
    side: OrderSide,
    price: Decimal,
    quantity: Decimal,
  ): Promise<{ jobId: string; queuedAt: Date }> {
    const job = await this.orderMatchingQueue.add(
      'match',
      {
        orderId,
        userId,
        assetId,
        side,
        price: price.toString(),
        quantity: quantity.toString(),
      } as OrderMatchingJobData,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log(`Order ${orderId} queued for matching. Job ID: ${job.id}`);

    return {
      jobId: job.id.toString(),
      queuedAt: new Date(),
    };
  }

  /**
   * Core matching logic - called by job processor
   * Implements FIFO matching engine
   */
  async matchOrder(data: OrderMatchingJobData): Promise<{ matched: number }> {
    const { orderId, userId, assetId, side: sideStr, price, quantity } = data;
    const side = sideStr;
    const priceDec = new Decimal(price);
    const quantityDec = new Decimal(quantity);

    try {
      // Fetch the order
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order || order.status !== 'OPEN') {
        this.logger.warn(
          `Order ${orderId} is not in OPEN status. Skipping match.`,
        );
        return { matched: 0 };
      }

      // Find matching orders from counterparty
      const oppositeOrderSide = side === 'BUY' ? 'SELL' : 'BUY';
      const priceFilter =
        side === 'BUY' ? { lte: priceDec } : { gte: priceDec };

      const matchingOrders = await this.prisma.order.findMany({
        where: {
          assetId,
          side: oppositeOrderSide,
          status: 'OPEN',
          price: priceFilter,
          NOT: { userId }, // Don't match with same user
        },
        orderBy: {
          createdAt: 'asc', // FIFO - match with oldest first
        },
      });

      let remainingQuantity = quantityDec;
      let tradeCount = 0;

      // Process each matching order
      for (const matchingOrder of matchingOrders) {
        if (remainingQuantity.isZero()) break;

        const matchableQuantity = Decimal.min(
          remainingQuantity,
          new Decimal(matchingOrder.quantity).minus(
            matchingOrder.filledQuantity,
          ),
        );

        const newOrderFilled = new Decimal(order.filledQuantity).plus(
          matchableQuantity,
        );
        const isOrderFilled = newOrderFilled.equals(quantityDec);
        const orderNewStatus: OrderStatus = isOrderFilled
          ? 'FILLED'
          : 'PARTIAL';

        const newMatchingOrderFilled = new Decimal(
          matchingOrder.filledQuantity,
        ).plus(matchableQuantity);
        const isMatchingOrderFilled = newMatchingOrderFilled.equals(
          new Decimal(matchingOrder.quantity),
        );
        const matchingOrderNewStatus: OrderStatus = isMatchingOrderFilled
          ? 'FILLED'
          : 'PARTIAL';

        // Execute trade atomically
        await this.prisma.$transaction([
          // Update original order
          this.prisma.order.update({
            where: { id: orderId },
            data: {
              filledQuantity: newOrderFilled.toString(),
              status: orderNewStatus,
            },
          }),

          // Update matching order
          this.prisma.order.update({
            where: { id: matchingOrder.id },
            data: {
              filledQuantity: newMatchingOrderFilled.toString(),
              status: matchingOrderNewStatus,
            },
          }),

          // Persist a transaction record for this matched trade leg
          this.prisma.transaction.create({
            data: {
              userId,
              type: 'TRADE_MATCH',
              amount: matchableQuantity.times(priceDec).toString(),
              fee: '0',
              status: 'COMPLETED',
            },
          }),

          // Update buyer's asset balance
          ...(side === 'BUY'
            ? [
                this.prisma.balance.upsert({
                  where: { userId_assetId: { userId, assetId } },
                  create: {
                    userId,
                    assetId,
                    available: matchableQuantity.toString(),
                    locked: new Decimal(0).toString(),
                  },
                  update: {
                    available: {
                      increment: matchableQuantity.toString(),
                    },
                  },
                }),
              ]
            : []),

          // Update seller's USDT balance (collateral return)
          // Note: USDT balance has assetId = null (not a specific asset)
          ...(side === 'SELL'
            ? [
                this.prisma.balance.upsert({
                  where: { userId_assetId: { userId, assetId: '' } },
                  create: {
                    userId,
                    assetId: '',
                    available: matchableQuantity.times(priceDec).toString(),
                    locked: new Decimal(0).toString(),
                  },
                  update: {
                    available: {
                      increment: matchableQuantity.times(priceDec).toString(),
                    },
                  },
                }),
              ]
            : []),
        ]);

        remainingQuantity = remainingQuantity.minus(matchableQuantity);
        tradeCount++;
      }

      this.logger.log(
        `Order ${orderId} matched with ${tradeCount} counterparty orders. Remaining quantity: ${remainingQuantity.toString()}`,
      );

      return { matched: tradeCount };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Order matching failed for ${orderId}: ${errorMessage}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get pending orders count in queue
   */
  async getPendingOrdersCount(): Promise<number> {
    return this.orderMatchingQueue.count();
  }
}
