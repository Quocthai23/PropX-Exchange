import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderMatchingService } from './order-matching.service';
import { TradingLedgerService } from './trading-ledger.service';
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
    private readonly orderMatchingService: OrderMatchingService,
    private readonly tradingLedgerService: TradingLedgerService,
  ) {}

  private validatePriceBand(
    orderPrice: Decimal,
    referencePrice: Decimal | null,
    bandPercentage: Decimal | null,
  ) {
    if (!referencePrice) {
      throw new BadRequestException(
        'Asset reference price (NAV) is not configured for trading',
      );
    }

    const band = bandPercentage ?? new Decimal(0);
    const lowerBound = referencePrice.mul(new Decimal(1).minus(band));
    const upperBound = referencePrice.mul(new Decimal(1).plus(band));

    if (orderPrice.lt(lowerBound) || orderPrice.gt(upperBound)) {
      throw new BadRequestException(
        `Order price must stay within circuit breaker band [${lowerBound.toFixed()}, ${upperBound.toFixed()}] around NAV`,
      );
    }
  }

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
    if (type === 'LIMIT') {
      this.validatePriceBand(
        priceDec,
        asset.referencePrice ? new Decimal(asset.referencePrice.toString()) : null,
        asset.priceBandPercentage
          ? new Decimal(asset.priceBandPercentage.toString())
          : null,
      );
    }

    await this.prisma.$transaction(
      async (tx) => {
        await this.tradingLedgerService.lockOrderFunds({
          tx,
          userId,
          side,
          assetId,
          quantity: quantityDec,
          price: priceDec,
        });
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

    await this.orderMatchingService.queueOrder(order.id);

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
    if (!['PENDING', 'OPEN'].includes(order.status)) {
      throw new BadRequestException('Only open/pending orders can be updated');
    }

    if (order.type === 'MARKET') {
      throw new BadRequestException('Market order cannot be updated');
    }

    const hasPriceUpdate = dto.price !== undefined && dto.price !== null;
    if (!hasPriceUpdate) {
      throw new BadRequestException('No mutable fields provided');
    }

    const nextPrice = new Decimal(dto.price as string | number);
    if (nextPrice.lte(0)) {
      throw new BadRequestException('Price must be positive');
    }
    const asset = await this.prisma.asset.findUnique({
      where: { id: order.assetId },
      select: { referencePrice: true, priceBandPercentage: true },
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    this.validatePriceBand(
      nextPrice,
      asset.referencePrice ? new Decimal(asset.referencePrice.toString()) : null,
      asset.priceBandPercentage
        ? new Decimal(asset.priceBandPercentage.toString())
        : null,
    );

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { price: nextPrice },
      select: { id: true, status: true, price: true },
    });

    return {
      orderId: updated.id,
      status: updated.status,
      price: updated.price?.toString() ?? null,
    };
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
    await this.prisma.$transaction(
      async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'CANCELLED' },
        });

        await this.tradingLedgerService.unlockOrderRemainder({
          tx,
          userId,
          side: order.side,
          assetId: order.assetId,
          remainingQuantity,
          orderPrice: new Decimal(order.price?.toString() || 0),
        });
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
