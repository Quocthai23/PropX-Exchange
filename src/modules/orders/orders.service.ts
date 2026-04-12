import { BadRequestException, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import type { Balance } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderMatchingService } from './services/order-matching.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderMatchingService: OrderMatchingService,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    const { assetId, side } = dto;
    const price = new Decimal(dto.price);
    const quantity = new Decimal(dto.quantity);

    if (quantity.lte(0) || price.lte(0)) {
      throw new BadRequestException('Price and quantity must be positive');
    }

    // Validate asset exists
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new BadRequestException('Asset not found');
    }

    // Validate user has sufficient balance
    let balance: Balance | null;
    if (side === 'SELL') {
      balance = await this.prisma.balance.findUnique({
        where: { userId_assetId: { userId, assetId } },
      });
    } else {
      balance = await this.prisma.balance.findFirst({
        where: { userId, assetId: null },
      });
    }

    if (!balance || new Decimal(balance.available).lt(quantity)) {
      throw new BadRequestException('Insufficient balance');
    }

    // Create order
    const order = await this.prisma.order.create({
      data: {
        userId,
        assetId,
        side,
        price: price.toString(),
        quantity: quantity.toString(),
        filledQuantity: new Decimal(0).toString(),
        status: 'OPEN',
      },
    });

    // Lock balance if selling
    if (side === 'SELL') {
      await this.prisma.balance.update({
        where: { userId_assetId: { userId, assetId } },
        data: {
          available: { decrement: quantity.toString() },
          locked: { increment: quantity.toString() },
        },
      });
    }

    // Queue for matching
    await this.orderMatchingService.queueOrder(
      order.id,
      userId,
      assetId,
      side,
      price,
      quantity,
    );

    return {
      id: order.id,
      status: 'OPEN',
      message: 'Order created and queued for matching',
      matchingInProgress: true,
    };
  }

  findAll() {
    return `This action returns all orders`;
  }

  findOne(id: number) {
    return `This action returns a #${id} order`;
  }

  update(id: number): string {
    return `This action updates a #${id} order`;
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }
}
