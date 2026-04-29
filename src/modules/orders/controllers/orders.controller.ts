import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from '../services/orders.service';
import {
  BulkCancelOrdersDto,
  UpdateOrderDto,
  GetOrdersQueryDto,
  CreateOrderDto,
} from '../dto/orders.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';

@ApiTags('Orders')
@Controller('orders')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('bulk-cancel')
  @ApiOperation({
    summary: 'Bulk cancel orders',
    description: 'Cancel multiple open orders at once.',
  })
  async bulkCancel(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BulkCancelOrdersDto,
  ) {
    return this.ordersService.bulkCancelOrders(user.sub, dto);
  }

  @Patch(':orderId')
  @ApiOperation({
    summary: 'Update or cancel order',
    description: 'Update mutable fields or cancel by setting cancel=true',
  })
  async updateOrder(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.updateOrder(user.sub, orderId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List orders',
    description: 'List orders with filters and sorting',
  })
  async getOrders(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetOrdersQueryDto,
  ) {
    return this.ordersService.getOrders(user.sub, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create order',
    description: 'Create a new trading order (MARKET vs PENDING)',
  })
  async createOrder(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(user.sub, dto);
  }
}
