import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from '../services/orders.service';
import {
  BulkCancelOrdersDto,
  UpdateOrderDto,
  GetOrdersQueryDto,
  CreateOrderDto,
} from '../dto/orders.dto';
// TODO: Import JwtAuthGuard và CurrentUser từ auth module

@ApiTags('Orders')
@Controller('orders')
@ApiBearerAuth('accessToken')
// @UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('bulk-cancel')
  @ApiOperation({
    summary: 'Bulk cancel orders',
    description: 'Cancel multiple open orders at once.',
  })
  async bulkCancel(@Body() dto: BulkCancelOrdersDto) {
    const userId = 'mock-user-id'; // Lấy từ @CurrentUser
    return this.ordersService.bulkCancelOrders(userId, dto);
  }

  @Patch(':orderId')
  @ApiOperation({
    summary: 'Update or cancel order',
    description: 'Update mutable fields or cancel by setting cancel=true',
  })
  async updateOrder(
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderDto,
  ) {
    const userId = 'mock-user-id';
    return this.ordersService.updateOrder(userId, orderId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List orders',
    description: 'List orders with filters and sorting',
  })
  async getOrders(@Query() query: GetOrdersQueryDto) {
    const userId = 'mock-user-id';
    return this.ordersService.getOrders(userId, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create order',
    description: 'Create a new trading order (MARKET vs PENDING)',
  })
  async createOrder(@Body() dto: CreateOrderDto) {
    const userId = 'mock-user-id';
    return this.ordersService.createOrder(userId, dto);
  }
}
