import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../prisma/prisma.service';
import { BlockchainService } from './blockchain.service';

export interface GasSpeedUpRequest {
  transactionId: string;
  multiplier: number; // e.g., 1.5 for 50% increase
}

export interface GasRefundRequest {
  transactionId: string;
  reason: string;
}

@Injectable()
export class GasSpikeService {
  private readonly logger = new Logger(GasSpikeService.name);

  // Configuration (can be moved to environment variables)
  private readonly STUCK_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
  private readonly MAX_SPEED_UP_ATTEMPTS = 5;
  private readonly MIN_GAS_MULTIPLIER = 1.1;
  private readonly MAX_GAS_MULTIPLIER = 3.0;

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
  ) {}

  /**
   * Check if transaction is stuck and mark it for intervention
   */
  async checkStuckTransactions(): Promise<void> {
    const pendingTxs = await this.prisma.transaction.findMany({
      where: {
        status: 'PENDING',
        txHash: { not: null },
        type: 'WITHDRAW',
        stuckSince: null, // Not already marked as stuck
      },
    });

    const now = new Date();
    const stuckThreshold = new Date(now.getTime() - this.STUCK_TIMEOUT_MS);

    for (const tx of pendingTxs) {
      const zeroConfirmationsFor =
        tx.confirmations === 0 && tx.createdAt < stuckThreshold;

      if (zeroConfirmationsFor) {
        await this.prisma.transaction.update({
          where: { id: tx.id },
          data: {
            stuckSince: now,
          },
        });

        this.logger.warn(
          `Transaction ${tx.id} (${tx.txHash}) marked as stuck after 1 hour with 0 confirmations.`,
        );
      }
    }
  }

  /**
   * Speed up a stuck transaction by increasing gas price
   */
  async speedUpTransaction(request: GasSpeedUpRequest): Promise<{
    message: string;
    newTxHash: string;
    speedUpCost: string;
  }> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: request.transactionId },
    });

    if (!tx) {
      throw new BadRequestException('Transaction not found.');
    }

    if (tx.type !== 'WITHDRAW') {
      throw new BadRequestException(
        'Speed-up is only available for withdrawal transactions.',
      );
    }

    if (tx.status !== 'PENDING' || !tx.txHash) {
      throw new BadRequestException(
        `Cannot speed up transaction with status ${tx.status}.`,
      );
    }

    // Validate speed-up attempts
    if (tx.speedUpAttempts >= this.MAX_SPEED_UP_ATTEMPTS) {
      throw new BadRequestException(
        `Maximum speed-up attempts (${this.MAX_SPEED_UP_ATTEMPTS}) reached. Please request a refund instead.`,
      );
    }

    // Validate multiplier
    const multiplier = Math.max(
      this.MIN_GAS_MULTIPLIER,
      Math.min(request.multiplier, this.MAX_GAS_MULTIPLIER),
    );

    // Get current gas price from blockchain
    const currentGasPrice = await this.blockchainService.getCurrentGasPrice();

    // Calculate new gas price
    const oldGasPrice = tx.lastGasPrice || tx.gasPrice || currentGasPrice;
    const newGasPrice = new Decimal(oldGasPrice.toString())
      .times(multiplier)
      .toDecimalPlaces(0);

    if (newGasPrice.lessThanOrEqualTo(oldGasPrice)) {
      throw new BadRequestException(
        `New gas price must be higher than current price (${oldGasPrice.toString()} wei).`,
      );
    }

    // Get user wallet address
    const user = await this.prisma.user.findUnique({
      where: { id: tx.userId },
    });

    if (!user) {
      throw new BadRequestException('User not found.');
    }

    try {
      // Execute speed-up transaction
      const newTxHash = await this.blockchainService.speedUpWithdrawal(
        tx.txHash,
        user.walletAddress,
        new Decimal(tx.amount.toString()),
        newGasPrice,
      );

      // Estimate additional gas cost
      const gasEstimate = await this.blockchainService.estimateGasCost(
        new Decimal(tx.amount.toString()),
        newGasPrice,
      );
      const gasDifference = new Decimal(gasEstimate.toString()).minus(
        tx.fee || 0,
      );

      // Record speed-up attempt
      await this.prisma.$transaction(async (prismaTx) => {
        await prismaTx.transaction.update({
          where: { id: tx.id },
          data: {
            txHash: newTxHash,
            lastGasPrice: newGasPrice,
            speedUpAttempts: { increment: 1 },
          },
        });

        await prismaTx.gasSpeedUpAttempt.create({
          data: {
            transactionId: tx.id,
            previousTxHash: tx.txHash!, // tx.txHash is guaranteed non-null from earlier check
            newTxHash: newTxHash,
            oldGasPrice: new Decimal(oldGasPrice.toString()),
            newGasPrice,
            gasFeePaid: gasDifference,
            status: 'PENDING',
          },
        });

        // Audit log
        await prismaTx.auditLog.create({
          data: {
            entity: 'WITHDRAWAL_SPEEDUP',
            entityId: tx.id,
            action: 'SPEEDUP_INITIATED',
            performedBy: tx.userId,
            details: `Speed-up initiated for transaction ${tx.txHash}. New gas price: ${newGasPrice.toString()} wei (${multiplier}x multiplier). New txHash: ${newTxHash}`,
          },
        });
      });

      this.logger.log(
        `Transaction ${tx.id} speed-up initiated. New txHash: ${newTxHash}`,
      );

      return {
        message: 'Transaction speed-up initiated successfully.',
        newTxHash,
        speedUpCost: gasDifference.toFixed(6),
      };
    } catch (error) {
      this.logger.error(`Failed to speed up transaction ${tx.id}:`, error);
      throw new InternalServerErrorException(
        'Failed to speed up transaction on blockchain.',
      );
    }
  }

  /**
   * Process refund for stuck transaction
   */
  async processRefund(request: GasRefundRequest): Promise<{
    message: string;
    refundTxHash: string;
    refundAmount: string;
  }> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: request.transactionId },
    });

    if (!tx) {
      throw new BadRequestException('Transaction not found.');
    }

    if (tx.type !== 'WITHDRAW') {
      throw new BadRequestException(
        'Refund is only available for withdrawal transactions.',
      );
    }

    if (tx.refundStatus !== 'NONE') {
      throw new BadRequestException(
        `Transaction already has refund status: ${tx.refundStatus}`,
      );
    }

    // Only allow refund if stuck for extended period
    if (!tx.stuckSince) {
      throw new BadRequestException(
        'Transaction must be marked as stuck before refunding.',
      );
    }

    const now = new Date();
    const stuckDuration = now.getTime() - tx.stuckSince.getTime();
    const minStuckDuration = 2 * 60 * 60 * 1000; // 2 hours minimum

    if (stuckDuration < minStuckDuration) {
      throw new BadRequestException(
        'Transaction must be stuck for at least 2 hours before refunding.',
      );
    }

    if (!tx.txHash) {
      throw new BadRequestException(
        'Transaction has no on-chain hash and cannot be refunded on blockchain.',
      );
    }

    try {
      // Process refund on chain (cancel original transaction + refund to user)
      const refundTxHash = await this.blockchainService.processRefund(
        tx.txHash,
      );

      // Update user balance
      await this.prisma.$transaction(async (prismaTx) => {
        // Mark transaction as refunded
        await prismaTx.transaction.update({
          where: { id: tx.id },
          data: {
            status: 'REFUNDED',
            refundStatus: 'COMPLETED',
            refundTxHash,
          },
        });

        // Restore locked balance to available
        await prismaTx.balance.updateMany({
          where: { userId: tx.userId, assetId: null },
          data: {
            locked: { decrement: tx.amount },
            available: { increment: tx.amount },
          },
        });

        // Audit log
        await prismaTx.auditLog.create({
          data: {
            entity: 'WITHDRAWAL_REFUND',
            entityId: tx.id,
            action: 'REFUND_PROCESSED',
            performedBy: 'SYSTEM',
            details: `Withdrawal refund processed due to: ${request.reason}. Refund txHash: ${refundTxHash}. Amount: ${tx.amount.toString()}`,
          },
        });
      });

      this.logger.log(
        `Refund processed for transaction ${tx.id}. Refund txHash: ${refundTxHash}`,
      );

      return {
        message:
          'Refund processed successfully. Amount restored to your balance.',
        refundTxHash,
        refundAmount: tx.amount.toFixed(6),
      };
    } catch (error) {
      this.logger.error(
        `Failed to process refund for transaction ${tx.id}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to process refund on blockchain.',
      );
    }
  }

  /**
   * Get gas spike status and recommendations
   */
  async getGasStatus(transactionId: string): Promise<{
    transactionId: string;
    status: string;
    isStuck: boolean;
    stuckSince: Date | null;
    speedUpAttempts: number;
    maxSpeedUpAttempts: number;
    canSpeedUp: boolean;
    canRefund: boolean;
    recommendations: string[];
    speedUpAttempts_: Array<{
      id: string;
      oldGasPrice: Decimal;
      newGasPrice: Decimal;
      status: string;
      createdAt: Date;
    }>;
  }> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        speedUpAttempts_: {
          select: {
            id: true,
            oldGasPrice: true,
            newGasPrice: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!tx) {
      throw new BadRequestException('Transaction not found.');
    }

    const isStuck = tx.stuckSince !== null;
    const canSpeedUp =
      tx.status === 'PENDING' &&
      tx.speedUpAttempts < this.MAX_SPEED_UP_ATTEMPTS &&
      tx.type === 'WITHDRAW';

    const minStuckDuration = 2 * 60 * 60 * 1000; // 2 hours
    const stuckDuration = tx.stuckSince
      ? new Date().getTime() - tx.stuckSince.getTime()
      : 0;
    const canRefund =
      isStuck &&
      stuckDuration >= minStuckDuration &&
      tx.refundStatus === 'NONE' &&
      tx.type === 'WITHDRAW';

    const recommendations: string[] = [];

    if (tx.confirmations === 0 && tx.createdAt) {
      const txAge = new Date().getTime() - tx.createdAt.getTime();
      if (txAge > 30 * 60 * 1000) {
        // 30 minutes
        recommendations.push(
          'Transaction has been pending for 30+ minutes. Consider speeding up if gas prices have dropped.',
        );
      }
    }

    if (isStuck) {
      recommendations.push(
        'Transaction is stuck. You can attempt to speed up or request a refund if it has been stuck for 2+ hours.',
      );
    }

    if (
      tx.speedUpAttempts > 0 &&
      tx.speedUpAttempts < this.MAX_SPEED_UP_ATTEMPTS
    ) {
      recommendations.push(
        `You have ${tx.speedUpAttempts} speed-up attempt(s) used. ${this.MAX_SPEED_UP_ATTEMPTS - tx.speedUpAttempts} attempt(s) remaining.`,
      );
    }

    if (tx.speedUpAttempts >= this.MAX_SPEED_UP_ATTEMPTS) {
      recommendations.push(
        `Maximum speed-up attempts reached. Consider requesting a refund.`,
      );
    }

    return {
      transactionId: tx.id,
      status: tx.status,
      isStuck,
      stuckSince: tx.stuckSince,
      speedUpAttempts: tx.speedUpAttempts,
      maxSpeedUpAttempts: this.MAX_SPEED_UP_ATTEMPTS,
      canSpeedUp,
      canRefund,
      recommendations,
      speedUpAttempts_: tx.speedUpAttempts_,
    };
  }
}
