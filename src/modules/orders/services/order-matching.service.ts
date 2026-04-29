import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../prisma/prisma.service';
import { $Enums } from '@prisma/client';

type OrderSide = $Enums.OrderSide;
type OrderStatus = $Enums.OrderStatus;

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

      if (!order || order.status !== $Enums.OrderStatus.OPEN) {
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
          status: $Enums.OrderStatus.OPEN,
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
          ? $Enums.OrderStatus.FILLED
          : $Enums.OrderStatus.PARTIALLY_FILLED;

        const newMatchingOrderFilled = new Decimal(
          matchingOrder.filledQuantity,
        ).plus(matchableQuantity);
        const isMatchingOrderFilled = newMatchingOrderFilled.equals(
          new Decimal(matchingOrder.quantity),
        );
        const matchingOrderNewStatus: OrderStatus = isMatchingOrderFilled
          ? $Enums.OrderStatus.FILLED
          : $Enums.OrderStatus.PARTIALLY_FILLED;

        // Execute trade atomically
        await this.prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: orderId },
            data: {
              filledQuantity: newOrderFilled.toString(),
              status: orderNewStatus,
            },
          });

          await tx.order.update({
            where: { id: matchingOrder.id },
            data: {
              filledQuantity: newMatchingOrderFilled.toString(),
              status: matchingOrderNewStatus,
            },
          });

          await tx.transaction.create({
            data: {
              userId,
              type:
                side === $Enums.OrderSide.BUY
                  ? $Enums.TransactionType.TRADE_BUY
                  : $Enums.TransactionType.TRADE_SELL,
              amount: matchableQuantity.times(priceDec).toString(),
              fee: '0',
              status: $Enums.TransactionStatus.COMPLETED,
            },
          });

          if (side === $Enums.OrderSide.BUY) {
            await tx.balance.upsert({
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
            });
          }

          if (side === $Enums.OrderSide.SELL) {
            const cashBalance = await tx.balance.findFirst({
              where: { userId, assetId: null },
              select: { id: true },
            });

            if (cashBalance) {
              await tx.balance.update({
                where: { id: cashBalance.id },
                data: {
                  available: {
                    increment: matchableQuantity.times(priceDec).toString(),
                  },
                },
              });
            } else {
              await tx.balance.create({
                data: {
                  userId,
                  assetId: null,
                  available: matchableQuantity.times(priceDec).toString(),
                  locked: new Decimal(0).toString(),
                },
              });
            }
          }
        });

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
