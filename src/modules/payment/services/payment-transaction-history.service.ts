import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { GetTransactionHistoryDto } from '../dto/payment.dto';

@Injectable()
export class PaymentTransactionHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserHistory(userId: string, query: GetTransactionHistoryDto) {
    const where = this.buildWhere(query, userId);
    return this.findHistory(where, query);
  }

  async getAdminHistory(query: GetTransactionHistoryDto) {
    const where = this.buildWhere(query);
    return this.findHistory(where, query);
  }

  private buildWhere(query: GetTransactionHistoryDto, userId?: string) {
    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    return where;
  }

  private async findHistory(
    where: Record<string, unknown>,
    query: GetTransactionHistoryDto,
  ) {
    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip || 0,
        take: query.take || 20,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { data, total };
  }
}
