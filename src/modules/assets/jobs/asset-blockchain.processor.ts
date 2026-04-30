import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import Decimal from 'decimal.js';
import { parseUnits } from 'ethers';
import { PrismaService } from '@/prisma/prisma.service';
import { BlockchainService } from '../services/blockchain.service';

interface FinalizeMintJob {
  assetId: string;
  txHash: string;
}

interface LiquidationBurnJob {
  assetId: string;
  liquidationPrice: string;
  burnAmount: string;
}

interface RedemptionBurnJob {
  redemptionId: string;
  txHash: string;
}

@Processor('asset-blockchain', { concurrency: 1 })
export class AssetBlockchainProcessor extends WorkerHost {
  private readonly logger = new Logger(AssetBlockchainProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
  ) {
    super();
  }

  private get db(): any {
    return this.prisma as any;
  }

  async process(job: Job<FinalizeMintJob | LiquidationBurnJob | RedemptionBurnJob>) {
    if (job.name === 'finalize-mint') {
      await this.finalizeMint(job.data as FinalizeMintJob);
    } else if (job.name === 'liquidation-burn') {
      await this.processLiquidationBurn(job.data as LiquidationBurnJob);
    } else if (job.name === 'finalize-redemption-burn') {
      await this.finalizeRedemptionBurn(job.data as RedemptionBurnJob);
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job | undefined, error: Error) {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      this.logger.warn(
        `Job ${job.name}:${job.id} failed attempt ${job.attemptsMade}/${maxAttempts}.`,
      );
      return;
    }

    this.logger.error(
      `Job ${job.name}:${job.id} moved to DLQ path after ${job.attemptsMade} attempts.`,
      error,
    );
    const admin = await this.db.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    if (!admin?.id) {
      this.logger.error(
        `Unable to write AuditLog for failed job ${job.id}: no admin user found.`,
      );
      return;
    }

    await this.db.auditLog.create({
      data: {
        entity: 'ASSET_BLOCKCHAIN_JOB',
        entityId: String(job.id),
        action: 'FAILED_MAX_RETRIES',
        performedBy: admin.id,
        details: JSON.stringify({
          jobName: job.name,
          attemptsMade: job.attemptsMade,
          maxAttempts,
          reason: error?.message ?? 'Unknown queue error',
          payload: job.data,
        }),
      },
    });
  }

  private async finalizeMint(data: FinalizeMintJob) {
    const contractAddress = await this.blockchainService.waitForTokenizeReceipt(
      data.txHash,
    );
    await this.db.$transaction(async (tx: any) => {
      await tx.asset.update({
        where: { id: data.assetId },
        data: {
          isActive: true,
          tradingStatus: 'OPEN',
          contractAddress,
        },
      });
      await tx.transaction.updateMany({
        where: {
          type: 'MINT',
          txHash: data.txHash,
          status: 'PENDING',
        },
        data: {
          status: 'COMPLETED',
          confirmations: await this.blockchainService.getRequiredConfirmations(),
        },
      });
    });
  }

  private async processLiquidationBurn(data: LiquidationBurnJob) {
    const asset = await this.db.asset.findUnique({
      where: { id: data.assetId },
      select: { contractAddress: true, id: true },
    });
    if (!asset?.contractAddress) {
      throw new Error('Asset contractAddress missing for liquidation burn.');
    }

    const burnTxHash = await this.blockchainService.burnAssetToken({
      assetAddress: asset.contractAddress,
      amount: parseUnits(new Decimal(data.burnAmount).toString(), 18),
    });

    await this.db.asset.update({
      where: { id: data.assetId },
      data: { isActive: false, tradingStatus: 'PAUSED' },
    });

    const success = await this.blockchainService.isTransactionSuccessful(burnTxHash);
    if (!success) {
      throw new Error(`Liquidation burn failed: ${burnTxHash}`);
    }

    const holdings = await this.db.balance.findMany({
      where: { assetId: data.assetId, OR: [{ available: { gt: '0' } }, { locked: { gt: '0' } }] },
    });
    const liquidationPriceDec = new Decimal(data.liquidationPrice);
    for (const holding of holdings) {
      const totalHeld = new Decimal(holding.available).plus(holding.locked);
      if (totalHeld.lte(0)) continue;
      const payoutAmount = totalHeld.mul(liquidationPriceDec);
      await this.db.$transaction(async (tx: any) => {
        await tx.balance.upsert({
          where: { userId_assetId: { userId: holding.userId, assetId: null } },
          update: { available: { increment: payoutAmount.toString() } },
          create: {
            userId: holding.userId,
            assetId: null,
            available: payoutAmount.toString(),
            locked: '0',
          },
        });
        await tx.balance.update({
          where: { id: holding.id },
          data: { available: '0', locked: '0' },
        });
      });
    }
    await this.db.asset.update({
      where: { id: data.assetId },
      data: { tradingStatus: 'CLOSED' },
    });
  }

  private async finalizeRedemptionBurn(data: RedemptionBurnJob) {
    const success = await this.blockchainService.isTransactionSuccessful(data.txHash);
    if (!success) {
      await this.db.assetRedemptionRequest.update({
        where: { id: data.redemptionId },
        data: { status: 'PROCESSING_LEGAL' },
      });
      return;
    }

    await this.db.assetRedemptionRequest.update({
      where: { id: data.redemptionId },
      data: { status: 'COMPLETED' },
    });
  }
}
