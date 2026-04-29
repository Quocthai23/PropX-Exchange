import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BalancesService } from '../../balances/services/balances.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Decimal from 'decimal.js';
import { $Enums } from '@prisma/client';
import {
  DepositDemoDto,
  CreateWalletDto,
  WithdrawV2Dto,
  TransferV2Dto,
  GetTransactionHistoryDto,
  AdminUpdateWithdrawStatusDto,
  AdminSweepFundsDto,
} from '../dto/payment.dto';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balancesService: BalancesService,
    @InjectQueue('transaction-processing')
    private readonly transactionQueue: Queue,
  ) {}

  async depositDemo(userId: string, dto: DepositDemoDto) {
    const { amount, idempotencyKey } = dto;
    const amountDec = new Decimal(amount);

    if (amountDec.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Amount must be positive');
    }

    if (idempotencyKey) {
      const existingTx = await this.prisma.transaction.findUnique({
        where: { idempotencyKey },
      });
      if (existingTx) {
        return { success: true, transactionId: existingTx.id };
      }
    }

    await this.balancesService.updateBalance(userId, null, amountDec, 'credit');

    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        type: $Enums.TransactionType.DEPOSIT,
        amount: amountDec,
        status: $Enums.TransactionStatus.COMPLETED,
        idempotencyKey,
      },
    });

    return {
      transactionId: transaction.id,
      success: true,
    };
  }

  async createWallet(userId: string, dto: CreateWalletDto) {
    void dto;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true },
    });

    return {
      wallet: {
        userId,
        address: user?.walletAddress ?? null,
        chainId: dto.chainId ?? null,
        type: dto.type ?? null,
      },
    };
  }

  async processWithdrawal(userId: string, dto: WithdrawV2Dto) {
    const { amount, destinationAddress, chainId, idempotencyKey } = dto;
    void destinationAddress;
    void chainId;
    const amountDec = new Decimal(amount);

    if (idempotencyKey) {
      const existingTx = await this.prisma.transaction.findUnique({
        where: { idempotencyKey },
      });
      if (existingTx) {
        return { success: true, transactionId: existingTx.id };
      }
    }

    await this.balancesService.updateBalance(userId, null, amountDec, 'debit', {
      useAvailable: true,
    });
    await this.balancesService.updateBalance(
      userId,
      null,
      amountDec,
      'credit',
      { useLocked: true },
    );

    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        type: $Enums.TransactionType.WITHDRAW,
        amount: amountDec,
        status: $Enums.TransactionStatus.PENDING,
        idempotencyKey,
      },
    });

    await this.transactionQueue.add('process', {
      transactionId: transaction.id,
    });

    return { success: true, transactionId: transaction.id };
  }

  async processTransfer(userId: string, dto: TransferV2Dto) {
    const { amount, assetId, idempotencyKey } = dto;
    void assetId;
    const amountDec = new Decimal(amount);

    if (amountDec.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Amount must be positive');
    }

    if (idempotencyKey) {
      const existingTx = await this.prisma.transaction.findUnique({
        where: { idempotencyKey },
      });
      if (existingTx) {
        return { success: true, transactionId: existingTx.id };
      }
    }

    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        type: $Enums.TransactionType.TRANSFER,
        amount: amountDec,
        status: $Enums.TransactionStatus.COMPLETED,
        idempotencyKey,
      },
    });

    return { success: true, transactionId: transaction.id };
  }

  async getHistory(userId: string, query: GetTransactionHistoryDto) {
    const where: any = { userId };
    if (query.type) {
      where.type = query.type;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip || 0,
        take: query.take || 20,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { data, total };
  }

  async adminGetHistory(query: GetTransactionHistoryDto) {
    const where: any = {};
    if (query.type) {
      where.type = query.type;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip || 0,
        take: query.take || 20,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { data, total };
  }

  async adminUpdateWithdrawStatus(
    transactionId: string,
    dto: AdminUpdateWithdrawStatusDto,
  ) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: dto.status,
        },
      });

      if (dto.status === $Enums.TransactionStatus.COMPLETED) {
        await this.balancesService.updateBalance(
          transaction.userId,
          null,
          new Decimal(transaction.amount.toString()),
          'debit',
          { useLocked: true },
        );
      } else if (
        dto.status === $Enums.TransactionStatus.FAILED ||
        dto.status === $Enums.TransactionStatus.CANCELLED
      ) {
        await this.balancesService.updateBalance(
          transaction.userId,
          null,
          new Decimal(transaction.amount.toString()),
          'debit',
          { useLocked: true },
        );
        await this.balancesService.updateBalance(
          transaction.userId,
          null,
          new Decimal(transaction.amount.toString()),
          'credit',
          { useAvailable: true },
        );
      }
    });

    return { success: true };
  }

  adminSweepFunds(dto: AdminSweepFundsDto) {
    return {
      chainId: dto.chainId,
      destinationWallet: dto.destinationWallet,
      totalSwept: '0',
      lastSweptTransactionId: 'tx_sweep_mock_123',
    };
  }
}
