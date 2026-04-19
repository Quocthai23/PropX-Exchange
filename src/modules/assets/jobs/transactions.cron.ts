import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { BlockchainService } from '../services/blockchain.service';
import { GasSpikeService } from '../services/gas-spike.service';

@Injectable()
export class TransactionsCron {
  private readonly logger = new Logger(TransactionsCron.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
    private gasSpikeService: GasSpikeService,
  ) {}

  @Cron('*/10 * * * * *')
  async checkPendingTransactions() {
    const pendingTxs = await this.prisma.transaction.findMany({
      where: { status: 'PENDING', txHash: { not: null } },
    });

    if (pendingTxs.length === 0) return;

    const requiredConfirmations =
      await this.blockchainService.getRequiredConfirmations();

    for (const tx of pendingTxs) {
      try {
        const confirmations =
          await this.blockchainService.getTransactionConfirmations(tx.txHash!);

        await this.prisma.transaction.update({
          where: { id: tx.id },
          data: { confirmations },
        });

        if (confirmations >= requiredConfirmations) {
          await this.prisma.$transaction(async (prismaTx) => {
            await prismaTx.transaction.update({
              where: { id: tx.id },
              data: { status: 'COMPLETED' },
            });

            if (tx.type === 'DEPOSIT') {
              await prismaTx.balance.updateMany({
                where: { userId: tx.userId, assetId: null },
                data: { available: { increment: tx.amount } },
              });
            } else if (tx.type === 'WITHDRAW') {
              await prismaTx.balance.updateMany({
                where: { userId: tx.userId, assetId: null },
                data: { locked: { decrement: tx.amount } },
              });
            }
          });
          this.logger.log(
            `Transaction ${tx.id} completed (${confirmations}/${requiredConfirmations} confirmations).`,
          );
        } else {
          this.logger.debug(
            `Transaction ${tx.id} is waiting for confirmations (${confirmations}/${requiredConfirmations}).`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error while scanning transaction ${tx.txHash}:`,
          error,
        );
      }
    }
  }

  @Cron('0 * * * * *') // Every minute
  async checkStuckTransactions() {
    try {
      await this.gasSpikeService.checkStuckTransactions();
    } catch (error) {
      this.logger.error('Error checking stuck transactions:', error);
    }
  }
}
