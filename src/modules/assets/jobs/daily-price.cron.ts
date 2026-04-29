import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class DailyPriceCron {
  private readonly logger = new Logger(DailyPriceCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async updateReferencePrices() {
    void this.prisma;
    this.logger.log(
      'Skipped automatic NAV update. referencePrice must be maintained manually by admin/valuation provider.',
    );
  }
}
