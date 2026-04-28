import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ClosePositionDto,
  BulkClosePositionsDto,
  UpdatePositionDto,
  GetUserPositionsQueryDto,
  GetAdminPositionsQueryDto,
} from '../dto/positions.dto';

@Injectable()
export class PositionsService {
  constructor(private readonly prisma: PrismaService) {}

  async closePosition(
    userId: string,
    positionId: string,
    dto: ClosePositionDto,
  ) {
    await Promise.resolve();
    void userId;
    void dto;
    // TODO: Khớp lệnh đóng vị thế với matching engine
    return { orderId: 'order_mock_123', status: 'PENDING' };
  }

  async bulkClosePositions(userId: string, dto: BulkClosePositionsDto) {
    await Promise.resolve();
    void userId;
    // TODO: Đóng hàng loạt qua matching engine
    return {
      results: dto.positionIds.map((id) => ({
        positionId: id,
        success: true,
        orderId: `order_${id}`,
        error: null,
      })),
      total: dto.positionIds.length,
      successCount: dto.positionIds.length,
      errorCount: 0,
    };
  }

  async updatePosition(
    userId: string,
    positionId: string,
    dto: UpdatePositionDto,
  ) {
    await Promise.resolve();
    void userId;
    void positionId;
    void dto;
    // TODO: Cập nhật giá TP/SL xuống DB
    return { success: true };
  }

  async getPositions(userId: string, query: GetUserPositionsQueryDto) {
    await Promise.resolve();
    void userId;
    void query;
    // TODO: Lấy dữ liệu từ DB (kèm filters)
    return { data: [], total: 0, nextCursor: null };
  }

  async getPositionsStats(userId: string, accountId: string) {
    await Promise.resolve();
    void userId;
    void accountId;
    // TODO: Aggregate thống kê lệnh/vị thế cho accountId
    return {
      positionSymbols: [],
      fxRateSymbols: [],
      openOrders: 0,
      openPositions: 0,
      closedPositions: 0,
      closedOrders: 0,
    };
  }

  async getAdminPositions(query: GetAdminPositionsQueryDto) {
    await Promise.resolve();
    void query;
    // TODO: Admin lấy dữ liệu tất cả user
    return { data: [], total: 0 };
  }
}
