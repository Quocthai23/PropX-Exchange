import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainService } from './blockchain.service';
import { DepositDto } from './deposit.dto';
import { WithdrawDto } from './withdraw.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
  ) {}

  private normalizeAmount(value: number): Decimal {
    const amount = new Decimal(value);
    if (!amount.isFinite() || amount.lte(0)) {
      throw new BadRequestException('Amount must be greater than zero.');
    }
    return amount.toDecimalPlaces(4, Decimal.ROUND_DOWN);
  }

  private ensureSufficientLocked(locked: Decimal, amount: Decimal): void {
    if (locked.lt(amount)) {
      throw new BadRequestException(
        'Locked balance is insufficient for this withdrawal transaction.',
      );
    }
  }

  async deposit(userId: string, dto: DepositDto) {
    const amount = this.normalizeAmount(dto.amount);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.walletAddress.toLowerCase() !== dto.walletAddress.toLowerCase()) {
      throw new BadRequestException(
        'Wallet address does not match authenticated user.',
      );
    }

    const existingTx = await this.prisma.transaction.findUnique({
      where: { txHash: dto.txHash },
    });
    if (existingTx) {
      throw new BadRequestException(
        'This transaction hash has already been processed.',
      );
    }

    const isValid = await this.blockchainService.verifyDeposit(
      dto.txHash,
      amount,
      dto.walletAddress,
    );
    if (!isValid) {
      throw new BadRequestException('Invalid on-chain deposit transaction.');
    }

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: 'DEPOSIT',
          amount: amount.toFixed(4),
          txHash: dto.txHash,
          status: 'COMPLETED',
        },
      });

      const balance = await tx.balance.findFirst({
        where: { userId, assetId: null },
      });
      if (balance) {
        await tx.balance.update({
          where: { id: balance.id },
          data: {
            available: new Decimal(balance.available).add(amount).toFixed(4),
          },
        });
      } else {
        await tx.balance.create({
          data: { userId, assetId: null, available: amount.toFixed(4) },
        });
      }

      return { message: 'Deposit completed successfully.', transaction };
    });
  }

  async requestWithdraw(userId: string, dto: WithdrawDto) {
    const amount = this.normalizeAmount(dto.amount);

    return this.prisma.$transaction(async (tx) => {
      const balance = await tx.balance.findFirst({
        where: { userId, assetId: null },
      });
      if (!balance || new Decimal(balance.available).lt(amount)) {
        throw new BadRequestException('Insufficient available balance.');
      }

      await tx.balance.update({
        where: { id: balance.id },
        data: {
          available: new Decimal(balance.available).sub(amount).toFixed(4),
          locked: new Decimal(balance.locked).add(amount).toFixed(4),
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: 'WITHDRAW',
          amount: amount.toFixed(4),
          status: 'PENDING',
        },
      });

      return {
        message: 'Withdrawal request submitted and queued for admin approval.',
        transaction,
      };
    });
  }

  async approveWithdraw(transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { user: true },
    });
    if (
      !transaction ||
      transaction.type !== 'WITHDRAW' ||
      transaction.status !== 'PENDING'
    ) {
      throw new BadRequestException(
        'Invalid or already processed withdrawal request.',
      );
    }

    const amount = new Decimal(transaction.amount.toString());

    if (!transaction.user.walletAddress) {
      throw new BadRequestException('Target user wallet address is missing.');
    }

    let txHash: string;
    try {
      txHash = await this.blockchainService.executeWithdrawal(
        transaction.user.walletAddress,
        amount,
      );
    } catch {
      await this.prisma.$transaction(async (tx) => {
        const balance = await tx.balance.findFirst({
          where: { userId: transaction.userId, assetId: null },
        });
        if (!balance) {
          throw new NotFoundException(
            'Balance not found for withdrawal rollback.',
          );
        }

        const locked = new Decimal(balance.locked);
        this.ensureSufficientLocked(locked, amount);

        await tx.balance.update({
          where: { id: balance.id },
          data: {
            locked: locked.sub(amount).toFixed(4),
            available: new Decimal(balance.available).add(amount).toFixed(4),
          },
        });

        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: 'FAILED' },
        });
      });

      throw new BadRequestException(
        'Blockchain transfer failed. Withdrawal request was reverted.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const balance = await tx.balance.findFirst({
        where: { userId: transaction.userId, assetId: null },
      });

      if (!balance) {
        throw new NotFoundException(
          'Balance not found for withdrawal completion.',
        );
      }

      const locked = new Decimal(balance.locked);
      this.ensureSufficientLocked(locked, amount);

      await tx.balance.update({
        where: { id: balance.id },
        data: { locked: locked.sub(amount).toFixed(4) },
      });

      const updatedTx = await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: 'COMPLETED', txHash },
      });

      return {
        message: 'Withdrawal approved and executed.',
        transaction: updatedTx,
      };
    });
  }

  async rejectWithdraw(transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (
      !transaction ||
      transaction.type !== 'WITHDRAW' ||
      transaction.status !== 'PENDING'
    ) {
      throw new BadRequestException(
        'Invalid or already processed withdrawal request.',
      );
    }

    const amount = new Decimal(transaction.amount.toString());

    return this.prisma.$transaction(async (tx) => {
      const balance = await tx.balance.findFirst({
        where: { userId: transaction.userId, assetId: null },
      });

      if (!balance) {
        throw new NotFoundException(
          'Balance not found for withdrawal rejection.',
        );
      }

      const locked = new Decimal(balance.locked);
      this.ensureSufficientLocked(locked, amount);

      await tx.balance.update({
        where: { id: balance.id },
        data: {
          locked: locked.sub(amount).toFixed(4),
          available: new Decimal(balance.available).add(amount).toFixed(4),
        },
      });

      const updatedTx = await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });

      return {
        message: 'Withdrawal rejected and balance unlocked.',
        transaction: updatedTx,
      };
    });
  }
}
