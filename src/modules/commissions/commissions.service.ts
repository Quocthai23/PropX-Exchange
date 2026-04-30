import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { COMMISSIONS_QUEUE } from './commissions.module';
import { CommissionEvent } from '@prisma/client';

export interface CommissionJobData {
  eventType: CommissionEvent;
  sourceUserId: string;
  amount: number;       // The base amount (e.g. fee paid, yield amount)
  sourceTxId?: string;  // Tx that triggered this
  currency?: string;    // e.g. USDT
}

@Injectable()
export class CommissionsService {
  constructor(
    @InjectQueue(COMMISSIONS_QUEUE)
    private readonly commissionsQueue: Queue,
  ) {}

  async triggerCommission(data: CommissionJobData) {
    await this.commissionsQueue.add('process-commission', data, {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }
}
