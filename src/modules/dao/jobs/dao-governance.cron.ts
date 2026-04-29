import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DaoService } from '../services/dao.service';

@Injectable()
export class DaoGovernanceCron {
  constructor(private readonly daoService: DaoService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async run() {
    const now = new Date();
    await this.daoService.processSnapshots(now);
    await this.daoService.finalizeProposals(now);
  }
}

