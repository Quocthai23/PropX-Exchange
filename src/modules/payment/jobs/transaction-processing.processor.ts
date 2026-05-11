import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BlockchainService } from '../../assets/services/blockchain.service';
import Decimal from 'decimal.js';

@Injectable()
@Processor('transaction-processing', { concurrency: 1 })
export class TransactionProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(TransactionProcessingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
  ) {
    super();
  }

  async process(job: Job<{ transactionId: string }>): Promise<void> {
    const { transactionId } = job.data;
    this.logger.log(`Processing transaction job for ID: ${transactionId}`);

    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { user: true },
    });

    if (!tx) {
      this.logger.warn(`Transaction ${transactionId} not found. Skipping.`);
      return;
    }

    if (tx.status !== 'PENDING' || tx.type !== 'WITHDRAW') {
      this.logger.warn(
        `Transaction ${transactionId} is not a PENDING WITHDRAWAL. Current status: ${tx.status}. Skipping.`,
      );
      return;
    }

    if (tx.txHash) {
      this.logger.warn(
        `Transaction ${transactionId} already has a txHash (${tx.txHash}). Skipping.`,
      );
      return;
    }

    if (!tx.user?.walletAddress) {
      this.logger.error(
        `User ${tx.userId} does not have a linked wallet address for withdrawal ${transactionId}.`,
      );
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'FAILED' },
      });
      return;
    }

    try {
      this.logger.log(
        `Executing on-chain withdrawal of ${tx.amount} USDT for user ${tx.userId} (${tx.user.walletAddress})`,
      );

      const txHash = await this.blockchainService.executeWithdrawal(
        tx.user.walletAddress,
        new Decimal(tx.amount.toString()),
      );

      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { txHash },
      });

      this.logger.log(
        `Successfully broadcasted withdrawal ${transactionId} with txHash: ${txHash}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to execute withdrawal for transaction ${transactionId}`,
        error,
      );
      // Wait to retry or mark as FAILED based on error type
      // For now, we throw to let BullMQ retry it based on queue settings
      throw error;
    }
  }
}
