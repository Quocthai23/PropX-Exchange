import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BalancesService } from '../../balances/services/balances.service';
import { OrderMatchingService } from './order-matching.service';
import {
  BulkCancelOrdersDto,
  UpdateOrderDto,
  GetOrdersQueryDto,
  CreateOrderDto,
} from '../dto/orders.dto';
import Decimal from 'decimal.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balancesService: BalancesService,
    private readonly orderMatchingService: OrderMatchingService,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    const { side, type, assetId, quantity, price, idempotencyKey } = dto;

    if (idempotencyKey) {
      const existingOrder = await this.prisma.order.findUnique({
        where: { idempotencyKey },
      });
      if (existingOrder) {
        return { orderId: existingOrder.id, status: existingOrder.status };
      }
    }

    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    if (!asset.isActive || asset.tradingStatus !== 'OPEN') {
      throw new BadRequestException('Asset is not available for trading');
    }

    const quantityDec = new Decimal(quantity);
    const priceDec =
      type === 'MARKET' ? asset.tokenPrice : new Decimal(price || 0);
    const totalCost = quantityDec.times(priceDec);

    await this.prisma.$transaction(
      async () => {
        if (side === 'BUY') {
          await this.balancesService.updateBalance(
            userId,
            null,
            totalCost,
            'debit',
            { useAvailable: true },
          );
          await this.balancesService.updateBalance(
            userId,
            null,
            totalCost,
            'credit',
            { useLocked: true },
          );
        } else if (side === 'SELL') {
          await this.balancesService.updateBalance(
            userId,
            assetId,
            quantityDec,
            'debit',
            { useAvailable: true },
          );
          await this.balancesService.updateBalance(
            userId,
            assetId,
            quantityDec,
            'credit',
            { useLocked: true },
          );
        }
      },
      { isolationLevel: 'Serializable' },
    );

    const order = await this.prisma.order.create({
      data: {
        userId,
        assetId,
        side,
        type,
        price: priceDec,
        quantity: quantityDec,
        filledQuantity: new Decimal(0),
        status: 'OPEN',
        idempotencyKey,
      },
    });

    await this.orderMatchingService.queueOrder(
      order.id,
      userId,
      assetId,
      side as 'BUY' | 'SELL',
      priceDec,
      quantityDec,
    );

    return { orderId: order.id, status: order.status };
  }

  async getOrders(userId: string, query: GetOrdersQueryDto) {
    const where: any = { userId };
    if (query.status) {
      where.status = query.status;
    }
    if (query.assetId) {
      where.assetId = query.assetId;
    }
    if (query.side) {
      where.side = query.side;
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip || 0,
        take: query.take || 20,
        include: { asset: true },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data, total, nextCursor: null };
  }

  async updateOrder(userId: string, orderId: string, dto: UpdateOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId) {
      throw new BadRequestException('Not order owner');
    }

    if (dto.cancel) {
      return this.cancelOrder(userId, orderId);
    }

    throw new BadRequestException('Update not implemented');
  }

  async cancelOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId) {
      throw new BadRequestException('Not order owner');
    }

    if (!['PENDING', 'OPEN', 'PARTIALLY_FILLED'].includes(order.status)) {
      throw new BadRequestException('Order cannot be cancelled');
    }

    const remainingQuantity = new Decimal(order.quantity.toString()).minus(
      new Decimal(order.filledQuantity.toString()),
    );
    const remainingValue = remainingQuantity.times(
      new Decimal(order.price?.toString() || 0),
    );

    await this.prisma.$transaction(
      async () => {
        await this.prisma.order.update({
          where: { id: orderId },
          data: { status: 'CANCELLED' },
        });

        if (order.side === 'BUY') {
          await this.balancesService.updateBalance(
            userId,
            null,
            remainingValue,
            'debit',
            { useLocked: true },
          );
          await this.balancesService.updateBalance(
            userId,
            null,
            remainingValue,
            'credit',
            { useAvailable: true },
          );
        } else {
          await this.balancesService.updateBalance(
            userId,
            order.assetId,
            remainingQuantity,
            'debit',
            { useLocked: true },
          );
          await this.balancesService.updateBalance(
            userId,
            order.assetId,
            remainingQuantity,
            'credit',
            { useAvailable: true },
          );
        }
      },
      { isolationLevel: 'Serializable' },
    );

    return { success: true };
  }

  async bulkCancelOrders(userId: string, dto: BulkCancelOrdersDto) {
    const results = await Promise.allSettled(
      dto.orderIds.map(async (orderId) => {
        try {
          await this.cancelOrder(userId, orderId);
          return { orderId, success: true, error: null };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          return { orderId, success: false, error: errorMessage };
        }
      }),
    );

    const formattedResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        orderId: dto.orderIds[index],
        success: false,
        error: result.reason?.message || 'Unknown error',
      };
    });

    const successCount = formattedResults.filter((r) => r.success).length;
    const errorCount = formattedResults.length - successCount;

    return {
      results: formattedResults,
      total: formattedResults.length,
      successCount,
      errorCount,
    };
  }
}
