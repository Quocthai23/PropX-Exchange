import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CommissionJobData } from './commissions.service';
import { BalancesService } from '../balances/services/balances.service';
import { Decimal } from 'decimal.js';

@Processor('commissions')
export class CommissionsProcessor extends WorkerHost {
  private readonly logger = new Logger(CommissionsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly balancesService: BalancesService,
  ) {
    super();
  }

  async process(job: Job<CommissionJobData>): Promise<void> {
    const { eventType, sourceUserId, amount, sourceTxId, currency = 'USDT' } = job.data;
    
    this.logger.debug(`Processing commission for event: ${eventType}, sourceUser: ${sourceUserId}, amount: ${amount}`);

    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Get the source user and find their referrer
        const sourceUser = await tx.user.findUnique({
          where: { id: sourceUserId },
          select: { referredBy: true }
        });

        if (!sourceUser || !sourceUser.referredBy) {
          this.logger.debug(`No referrer found for user ${sourceUserId}. Skipping commission.`);
          return;
        }

        const referrerId = sourceUser.referredBy;

        // 2. Get Commission Config for the event
        const config = await tx.commissionConfig.findUnique({
          where: { eventType }
        });

        if (!config || !config.isActive || Number(config.commissionRate) <= 0) {
          this.logger.debug(`Commission config for ${eventType} is inactive or zero. Skipping.`);
          return;
        }

        const rate = new Decimal(config.commissionRate.toString());
        const rewardAmount = new Decimal(amount.toString()).mul(rate);

        if (rewardAmount.lte(0)) {
          this.logger.debug(`Calculated reward amount is zero. Skipping.`);
          return;
        }

        // 3. Prevent duplicate commission for the same sourceTxId and eventType
        if (sourceTxId) {
          const existing = await tx.commissionReward.findFirst({
            where: {
              sourceUserId,
              eventType,
              sourceTxId
            }
          });
          if (existing) {
            this.logger.log(`Commission already paid for event ${eventType} and tx ${sourceTxId}. Skipping.`);
            return;
          }
        }

        // 4. Create the Reward Record
        await tx.commissionReward.create({
          data: {
            userId: referrerId,
            sourceUserId,
            eventType,
            amount: rewardAmount.toString(),
            currency,
            sourceTxId,
            status: 'PAID'
          }
        });

        // 5. Add to balance (USDT usually has assetId = null)
        await this.balancesService.updateBalance(
          referrerId,
          null, // Assuming USDT
          rewardAmount,
          'credit',
          { tx: tx as any }
        );

        // 6. Create Transaction History
        await tx.transaction.create({
          data: {
            userId: referrerId,
            type: 'COMMISSION',
            amount: rewardAmount.toString(),
            fee: '0',
            status: 'COMPLETED',
          }
        });

        this.logger.log(`Successfully paid commission of ${rewardAmount.toString()} ${currency} to user ${referrerId} for event ${eventType} from user ${sourceUserId}.`);
      });
    } catch (error) {
      this.logger.error(`Failed to process commission job ${job.id}`, error);
      throw error;
    }
  }
}
