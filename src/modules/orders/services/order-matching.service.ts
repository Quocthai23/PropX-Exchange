import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma/prisma.service';
import { TradingLedgerService } from './trading-ledger.service';
import { MarketDataService } from '@/modules/market-data/services/market-data.service';
import { ConfigService } from '@nestjs/config';

type OrderStatus =
  | 'PENDING'
  | 'OPEN'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELLED'
  | 'REJECTED';

interface OrderMatchingJobData {
  orderId: string;
}

@Injectable()
export class OrderMatchingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderMatchingService.name);
  private queues = new Map<string, Queue>();
  private workers = new Map<string, Worker>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tradingLedgerService: TradingLedgerService,
    private readonly marketDataService: MarketDataService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.logger.log('OrderMatchingService initialized');
  }

  async onModuleDestroy() {
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
  }

  private getRedisConnection() {
    return {
      host: this.configService.get<string>('REDIS_HOST'),
      port: this.configService.get<number>('REDIS_PORT'),
      password: this.configService.get<string>('REDIS_PASSWORD'),
    };
  }

  private getOrCreateQueue(assetId: string): Queue {
    let queue = this.queues.get(assetId);
    if (!queue) {
      const queueName = `matching:${assetId}`;
      queue = new Queue(queueName, { connection: this.getRedisConnection() });
      this.queues.set(assetId, queue);

      const worker = new Worker(
        queueName,
        async (job) => {
          await this.matchOrder(job.data);
        },
        { connection: this.getRedisConnection(), concurrency: 1 },
      );
      this.workers.set(assetId, worker);
    }
    return queue;
  }

  /**
   * Queue a new order for matching
   * This prevents deadlocks by processing orders serially via queue
   */
  async queueOrder(
    orderId: string,
    assetId: string,
  ): Promise<{ jobId: string; queuedAt: Date }> {
    const queue = this.getOrCreateQueue(assetId);
    const job = await queue.add('match', { orderId } as OrderMatchingJobData, {
      jobId: orderId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });

    this.logger.log(`Order ${orderId} queued for matching. Job ID: ${job.id}`);

    return {
      jobId: String(job.id ?? orderId),
      queuedAt: new Date(),
    };
  }

  /**
   * Core matching logic - called by job processor
   * Implements FIFO matching engine
   */
  async matchOrder(data: OrderMatchingJobData): Promise<{ matched: number }> {
    const { orderId } = data;
    const prisma = this.prisma as any;

    try {
      // Fetch the order
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order || order.status !== 'OPEN') {
        this.logger.warn(
          `Order ${orderId} is not in OPEN status. Skipping match.`,
        );
        return { matched: 0 };
      }

      const side = order.side;
      const assetId = order.assetId;
      const userId = order.userId;

      const priceDec = new Decimal(order.price?.toString() ?? 0);
      const quantityDec = new Decimal(order.quantity.toString());
      // Find matching orders from counterparty
      const oppositeOrderSide = side === 'BUY' ? 'SELL' : 'BUY';
      const priceFilter =
        order.type === 'MARKET'
          ? undefined
          : side === 'BUY'
            ? { lte: priceDec }
            : { gte: priceDec };

      const matchingOrders = await prisma.order.findMany({
        where: {
          assetId,
          side: oppositeOrderSide,
          status: 'OPEN',
          ...(priceFilter ? { price: priceFilter } : {}),
          NOT: { userId }, // Don't match with same user
        },
        orderBy:
          side === 'BUY'
            ? [{ price: 'asc' }, { createdAt: 'asc' }] // Best ask first, then time
            : [{ price: 'desc' }, { createdAt: 'asc' }], // Best bid first, then time
      });

      let remainingQuantity = quantityDec;
      let currentOrderFilled = new Decimal(order.filledQuantity.toString());
      let tradeCount = 0;
      const maxTotalCost =
        order.type === 'MARKET' && side === 'BUY'
          ? quantityDec.times(priceDec)
          : undefined;
      let totalSpent = new Decimal(0);

      const executedTrades: {
        assetId: string;
        price: string;
        quantity: string;
        executedAt: Date;
      }[] = [];

      await prisma.$transaction(async (tx: any) => {
        // Process all matches in a single DB transaction to reduce lock churn/deadlocks.
        for (const matchingOrder of matchingOrders) {
          if (remainingQuantity.isZero()) break;

          const matchingOrderRemaining = new Decimal(
            matchingOrder.quantity,
          ).minus(matchingOrder.filledQuantity);
          if (matchingOrderRemaining.lte(0)) continue;

          let matchableQuantity = Decimal.min(
            remainingQuantity,
            matchingOrderRemaining,
          );
          const matchPrice = new Decimal(matchingOrder.price?.toString() ?? 0);

          if (order.type === 'MARKET' && side === 'BUY' && maxTotalCost) {
            const cost = matchableQuantity.times(matchPrice);
            if (totalSpent.plus(cost).gt(maxTotalCost)) {
              const availableToSpend = maxTotalCost.minus(totalSpent);
              matchableQuantity = availableToSpend.div(matchPrice);
              if (matchableQuantity.lte(0)) break;
            }
          }

          const newOrderFilled = currentOrderFilled.plus(matchableQuantity);
          const isOrderFilled = newOrderFilled.equals(quantityDec);
          const orderNewStatus: OrderStatus = isOrderFilled
            ? 'FILLED'
            : 'PARTIALLY_FILLED';

          const newMatchingOrderFilled = new Decimal(
            matchingOrder.filledQuantity,
          ).plus(matchableQuantity);
          const isMatchingOrderFilled = newMatchingOrderFilled.equals(
            new Decimal(matchingOrder.quantity),
          );
          const matchingOrderNewStatus: OrderStatus = isMatchingOrderFilled
            ? 'FILLED'
            : 'PARTIALLY_FILLED';

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

          await tx.trade.create({
            data: {
              assetId,
              buyerId: side === 'BUY' ? userId : matchingOrder.userId,
              sellerId: side === 'SELL' ? userId : matchingOrder.userId,
              price: matchPrice,
              quantity: matchableQuantity,
            },
          });

          await tx.asset.update({
            where: { id: assetId },
            data: { tokenPrice: matchPrice },
          });

          executedTrades.push({
            assetId,
            price: matchPrice.toString(),
            quantity: matchableQuantity.toString(),
            executedAt: new Date(),
          });

          await this.tradingLedgerService.settleMatch({
            tx,
            buyerId: side === 'BUY' ? userId : matchingOrder.userId,
            sellerId: side === 'SELL' ? userId : matchingOrder.userId,
            assetId,
            quantity: matchableQuantity,
            price: matchPrice,
          });

          if (
            order.type === 'LIMIT' &&
            side === 'BUY' &&
            matchPrice.lt(priceDec)
          ) {
            const refundAmount = matchableQuantity.times(
              priceDec.minus(matchPrice),
            );
            await this.tradingLedgerService.refundBuyerPriceImprovement({
              tx,
              buyerId: userId,
              amount: refundAmount,
            });
          }

          remainingQuantity = remainingQuantity.minus(matchableQuantity);
          currentOrderFilled = newOrderFilled;
          if (order.type === 'MARKET' && side === 'BUY') {
            totalSpent = totalSpent.plus(matchableQuantity.times(matchPrice));
          }
          tradeCount++;
        }

        if (order.type === 'MARKET' && remainingQuantity.gt(0)) {
          await tx.order.update({
            where: { id: orderId },
            data: { status: 'CANCELLED' },
          });

          if (side === 'BUY' && maxTotalCost) {
            const unusedLocked = maxTotalCost.minus(totalSpent);
            if (unusedLocked.gt(0)) {
              await this.tradingLedgerService.refundBuyerPriceImprovement({
                tx,
                buyerId: userId,
                amount: unusedLocked,
              });
            }
          } else if (side === 'SELL') {
            await this.tradingLedgerService.unlockOrderRemainder({
              tx,
              userId,
              side,
              assetId,
              remainingQuantity,
              orderPrice: new Decimal(0),
            });
          }
        } else if (order.type === 'MARKET' && side === 'BUY' && maxTotalCost) {
          const unusedLocked = maxTotalCost.minus(totalSpent);
          if (unusedLocked.gt(0)) {
            await this.tradingLedgerService.refundBuyerPriceImprovement({
              tx,
              buyerId: userId,
              amount: unusedLocked,
            });
          }
        }
      });

      for (const trade of executedTrades) {
        await this.marketDataService.recordTrade(
          trade.assetId,
          trade.price,
          trade.quantity,
          trade.executedAt,
        );
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
    let count = 0;
    for (const queue of this.queues.values()) {
      count += await queue.count();
    }
    return count;
  }
}
