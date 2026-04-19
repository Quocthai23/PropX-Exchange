import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DividendsService } from '../services/dividends.service';

@Injectable()
export class DividendSnapshotCron {
  private readonly logger = new Logger(DividendSnapshotCron.name);

  constructor(private readonly dividendsService: DividendsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleDividendSnapshots() {
    await this.dividendsService.processSnapshots();
  }
}
