import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Decimal from 'decimal.js';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('order-matching') private orderMatchingQueue: Queue,
  ) {}

  async placeOrder(
    userId: string,
    assetId: string,
    side: 'BUY' | 'SELL',
    price: number,
    quantity: number,
    idempotencyKey: string,
  ) {
    const existingOrder = await this.prisma.order.findUnique({
      where: { idempotencyKey },
    });
    if (existingOrder) {
      throw new ConflictException('This order has already been created.');
    }

    const orderAmount = new Decimal(quantity);
    const orderPrice = new Decimal(price);
    const totalCost = orderAmount.mul(orderPrice);

    return this.prisma.$transaction(async (tx) => {
      if (side === 'BUY') {
        const usdtBalance = await tx.balance.findFirst({
          where: { userId, assetId: null },
        });

        if (!usdtBalance || new Decimal(usdtBalance.available).lt(totalCost)) {
          throw new BadRequestException(
            'Insufficient available USDT balance to place a buy order.',
          );
        }

        await tx.balance.update({
          where: { id: usdtBalance.id },
          data: {
            available: new Decimal(usdtBalance.available)
              .sub(totalCost)
              .toString(),
            locked: new Decimal(usdtBalance.locked).add(totalCost).toString(),
          },
        });
      } else if (side === 'SELL') {
        const assetBalance = await tx.balance.findFirst({
          where: { userId, assetId },
        });

        if (
          !assetBalance ||
          new Decimal(assetBalance.available).lt(orderAmount)
        ) {
          throw new BadRequestException(
            'Insufficient available RWA asset balance to place a sell order.',
          );
        }

        await tx.balance.update({
          where: { id: assetBalance.id },
          data: {
            available: new Decimal(assetBalance.available)
              .sub(orderAmount)
              .toString(),
            locked: new Decimal(assetBalance.locked)
              .add(orderAmount)
              .toString(),
          },
        });
      }

      const order = await tx.order.create({
        data: {
          userId,
          assetId,
          side,
          type: 'LIMIT',
          price: orderPrice.toString(),
          quantity: orderAmount.toString(),
          status: 'OPEN',
          idempotencyKey,
        },
      });

      await this.orderMatchingQueue.add('match-order', { orderId: order.id });
      return order;
    });
  }
}
