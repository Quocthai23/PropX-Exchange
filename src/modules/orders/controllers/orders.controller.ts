import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { OrdersService } from '../services/orders.service';
import { CreateOrderDto } from '../dto/create-order.dto';

import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

@Controller('orders')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(
    @CurrentUser() user: JwtPayload | undefined,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    if (!user?.sub || !createOrderDto.idempotencyKey) {
      throw new BadRequestException('Invalid authenticated user payload.');
    }
    return this.ordersService.placeOrder(
      user.sub,
      createOrderDto.assetId,
      createOrderDto.side,
      createOrderDto.price,
      createOrderDto.quantity,
      createOrderDto.idempotencyKey,
    );
  }
}

