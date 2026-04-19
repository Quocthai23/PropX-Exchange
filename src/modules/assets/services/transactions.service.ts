import { Injectable, BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../prisma/prisma.service';
import { BlockchainService } from './blockchain.service';
import { DepositDto } from '../deposit.dto';
import { WithdrawDto } from '../withdraw.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
  ) {}

  private async ensureCashBalance(
    userId: string,
    prismaClient: Pick<PrismaService, 'balance'> = this.prisma,
  ) {
    const existing = await prismaClient.balance.findFirst({
      where: { userId, assetId: null },
    });

    if (existing) {
      return existing;
    }

    return prismaClient.balance.create({
      data: { userId, assetId: null },
    });
  }

  async deposit(userId: string, dto: DepositDto) {
    const amount = new Decimal(dto.amount);

    const validOnChain = await this.blockchainService.verifyDeposit(
      dto.txHash,
      amount,
      dto.walletAddress,
    );

    if (!validOnChain) {
      throw new BadRequestException(
        'Unable to verify deposit transaction on blockchain.',
      );
    }

    const duplicated = await this.prisma.transaction.findUnique({
      where: { txHash: dto.txHash },
    });

    if (duplicated) {
      throw new BadRequestException(
        'This transaction hash has already been used.',
      );
    }

    return this.prisma.$transaction(async (prismaTx) => {
      await this.ensureCashBalance(userId, prismaTx);

      return prismaTx.transaction.create({
        data: {
          userId,
          type: 'DEPOSIT',
          amount,
          status: 'PENDING',
          txHash: dto.txHash,
        },
      });
    });
  }

  async requestWithdraw(userId: string, dto: WithdrawDto) {
    const amount = new Decimal(dto.amount);

    await this.ensureCashBalance(userId);

    return this.prisma.$transaction(async (prismaTx) => {
      const balance = await prismaTx.balance.findFirst({
        where: { userId, assetId: null },
      });

      if (
        !balance ||
        new Decimal(balance.available.toString()).lessThan(amount)
      ) {
        throw new BadRequestException(
          'Insufficient available balance for withdrawal.',
        );
      }

      await prismaTx.balance.update({
        where: { id: balance.id },
        data: {
          available: { decrement: amount },
          locked: { increment: amount },
        },
      });

      return prismaTx.transaction.create({
        data: {
          userId,
          type: 'WITHDRAW',
          amount,
          status: 'PENDING',
        },
      });
    });
  }

  async approveWithdraw(adminId: string, transactionId: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx || tx.type !== 'WITHDRAW' || tx.status !== 'PENDING') {
      throw new BadRequestException(
        'Withdrawal transaction does not exist or has already been processed.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: tx.userId },
    });
    if (!user) {
      throw new BadRequestException(
        'User not found for this withdrawal transaction.',
      );
    }

    // Get current gas price before executing withdrawal
    const gasPrice = await this.blockchainService.getCurrentGasPrice();

    const txHash = await this.blockchainService.executeWithdrawal(
      user.walletAddress,
      new Decimal(tx.amount.toString()),
    );

    await this.prisma.$transaction(async (prismaTx) => {
      await prismaTx.transaction.update({
        where: { id: tx.id },
        data: {
          txHash,
          gasPrice, // Store initial gas price
        },
      });

      // WRITE AUDIT LOG
      await prismaTx.auditLog.create({
        data: {
          entity: 'WITHDRAWAL',
          entityId: tx.id,
          action: 'APPROVED',
          performedBy: adminId,
          details: `Admin approved withdrawal of ${tx.amount.toString()} USDT. TxHash: ${txHash}. Gas Price: ${gasPrice.toString()} wei`,
        },
      });
    });
    return {
      message:
        'Withdrawal approved. The system is waiting for blockchain confirmation.',
    };
  }

  async rejectWithdraw(adminId: string, transactionId: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx || tx.type !== 'WITHDRAW' || tx.status !== 'PENDING') {
      throw new BadRequestException(
        'Withdrawal transaction does not exist or has already been processed.',
      );
    }

    await this.prisma.$transaction(async (prismaTx) => {
      await prismaTx.transaction.update({
        where: { id: tx.id },
        data: { status: 'FAILED' },
      });

      await prismaTx.balance.updateMany({
        where: { userId: tx.userId, assetId: null },
        data: {
          available: { increment: tx.amount },
          locked: { decrement: tx.amount },
        },
      });

      await prismaTx.auditLog.create({
        data: {
          entity: 'WITHDRAWAL',
          entityId: tx.id,
          action: 'REJECTED',
          performedBy: adminId,
          details: `Admin rejected withdrawal of ${tx.amount.toString()} USDT.`,
        },
      });
    });

    return { message: 'Withdrawal request rejected.' };
  }
}
