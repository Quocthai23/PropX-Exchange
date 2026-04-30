import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Decimal from 'decimal.js';
import {
  DepositDemoDto,
  CreateWalletDto,
  WithdrawV2Dto,
  TransferV2Dto,
  GetTransactionHistoryDto,
  AdminUpdateWithdrawStatusDto,
  AdminSweepFundsDto,
} from '../dto/payment.dto';
import { PaymentLedgerService } from './payment-ledger.service';
import { PaymentTransactionHistoryService } from './payment-transaction-history.service';

@Injectable()
export class PaymentService {
  private static readonly SWEEP_BATCH_SIZE = 500;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentLedgerService: PaymentLedgerService,
    private readonly paymentTransactionHistoryService: PaymentTransactionHistoryService,
    @InjectQueue('transaction-processing')
    private readonly transactionQueue: Queue,
  ) {}

  // Keep Prisma operations usable when IDE type resolution lags behind generated Prisma types.
  private get db(): any {
    return this.prisma as any;
  }

  async depositDemo(userId: string, dto: DepositDemoDto) {
    const { amount, idempotencyKey } = dto;
    const amountDec = new Decimal(amount);

    if (amountDec.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Amount must be positive');
    }

    const existingTx = await this.findByIdempotencyKey(idempotencyKey);
    if (existingTx) {
      return { success: true, transactionId: existingTx.id };
    }

    const transaction = await this.db.$transaction(async (tx: any) => {
      await this.paymentLedgerService.creditDeposit(userId, amountDec, tx);
      return tx.transaction.create({
        data: {
          userId,
          type: 'DEPOSIT',
          amount: amountDec,
          status: 'COMPLETED',
          idempotencyKey,
        },
      });
    });

    return {
      transactionId: transaction.id,
      success: true,
    };
  }

  async createWallet(userId: string, dto: CreateWalletDto) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.walletAddress) {
      await this.db.user.update({
        where: { id: userId },
        data: {
          walletAddress: dto.address,
        },
      });

      return {
        wallet: {
          userId,
          address: dto.address,
          chainId: dto.chainId ?? null,
          type: dto.type ?? 'EVM',
        },
      };
    }

    return {
      wallet: {
        userId,
        address: user.walletAddress,
        chainId: dto.chainId ?? null,
        type: dto.type ?? 'EVM',
      },
    };
  }

  async processWithdrawal(userId: string, dto: WithdrawV2Dto) {
    const { amount, destinationAddress, chainId, idempotencyKey } = dto;
    void destinationAddress;
    void chainId;
    const amountDec = new Decimal(amount);

    const existingTx = await this.findByIdempotencyKey(idempotencyKey);
    if (existingTx) {
      return { success: true, transactionId: existingTx.id };
    }

    await this.paymentLedgerService.lockWithdrawalFunds(userId, amountDec);

    const transaction = await this.db.transaction.create({
      data: {
        userId,
        type: 'WITHDRAW',
        amount: amountDec,
        status: 'PENDING',
        idempotencyKey,
      },
    });

    await this.transactionQueue.add('process', {
      transactionId: transaction.id,
    });

    return { success: true, transactionId: transaction.id };
  }

  async processTransfer(userId: string, dto: TransferV2Dto) {
    const { amount, idempotencyKey, toUserId, toEmail, assetId } = dto;
    void assetId;
    const amountDec = new Decimal(amount);

    if (amountDec.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Amount must be positive');
    }

    const existingTx = await this.findByIdempotencyKey(idempotencyKey);
    if (existingTx) {
      return { success: true, transactionId: existingTx.id };
    }

    if (!toUserId && !toEmail) {
      throw new BadRequestException('toUserId or toEmail is required');
    }

    const receiver = toUserId
      ? await this.db.user.findUnique({
          where: { id: toUserId },
          select: { id: true },
        })
      : await this.db.user.findUnique({
          where: { email: String(toEmail).toLowerCase().trim() },
          select: { id: true },
        });

    if (!receiver) {
      throw new NotFoundException('Receiver not found');
    }
    if (receiver.id === userId) {
      throw new BadRequestException('Cannot transfer to self');
    }

    const transaction = await this.db.$transaction(async (tx: any) => {
      await this.paymentLedgerService.transferAvailableBalance({
        tx,
        fromUserId: userId,
        toUserId: receiver.id,
        amount: amountDec,
      });

      const [outTx] = await Promise.all([
        tx.transaction.create({
          data: {
            userId,
            type: 'TRANSFER',
            amount: amountDec,
            status: 'COMPLETED',
            idempotencyKey,
          },
        }),
        tx.transaction.create({
          data: {
            userId: receiver.id,
            type: 'TRANSFER',
            amount: amountDec,
            status: 'COMPLETED',
          },
        }),
      ]);

      return outTx;
    });

    return { success: true, transactionId: transaction.id };
  }

  async getHistory(userId: string, query: GetTransactionHistoryDto) {
    return this.paymentTransactionHistoryService.getUserHistory(userId, query);
  }

  async adminGetHistory(query: GetTransactionHistoryDto) {
    return this.paymentTransactionHistoryService.getAdminHistory(query);
  }

  async adminUpdateWithdrawStatus(
    transactionId: string,
    dto: AdminUpdateWithdrawStatusDto,
  ) {
    const transaction = await this.db.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    await this.db.$transaction(async (tx: any) => {
      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: dto.status,
        },
      });

      await this.paymentLedgerService.applyWithdrawalStatus({
        tx,
        userId: transaction.userId,
        amount: new Decimal(transaction.amount.toString()),
        status: dto.status,
      });
    });

    return { success: true };
  }

  async adminSweepFunds(adminUserId: string, dto: AdminSweepFundsDto) {
    const adminUser = await this.db.user.findUnique({
      where: { id: adminUserId },
      select: { role: true },
    });

    if (!adminUser || adminUser.role !== 'ADMIN') {
      throw new ForbiddenException('Only admin can sweep funds');
    }

    let cursorId: string | undefined;
    let affectedWallets = 0;
    let totalSwept = new Decimal(0);
    const transactionIds: string[] = [];

    while (true) {
      const balances = await this.db.balance.findMany({
        where: {
          assetId: null,
          available: { gt: 0 },
        },
        orderBy: { id: 'asc' },
        take: PaymentService.SWEEP_BATCH_SIZE,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        select: {
          id: true,
          userId: true,
          available: true,
        },
      });

      if (balances.length === 0) {
        break;
      }

      cursorId = balances[balances.length - 1].id;

      const createdIds = await this.db.$transaction(async (tx: any) => {
        const batchIds: string[] = [];
        for (const balance of balances) {
          await tx.balance.update({
            where: { id: balance.id },
            data: { available: 0 },
          });

          const createdTx = await tx.transaction.create({
            data: {
              userId: balance.userId,
              type: 'TRANSFER',
              amount: balance.available,
              status: 'COMPLETED',
            },
            select: { id: true },
          });
          batchIds.push(createdTx.id);
        }
        return batchIds;
      });

      transactionIds.push(...createdIds);
      affectedWallets += balances.length;
      totalSwept = totalSwept.plus(
        balances.reduce(
          (sum, b) => sum.plus(b.available.toString()),
          new Decimal(0),
        ),
      );
    }

    await this.db.auditLog.create({
      data: {
        entity: 'PAYMENT_SWEEP',
        entityId: adminUserId,
        action: 'ADMIN_SWEEP_FUNDS',
        performedBy: adminUserId,
        details: JSON.stringify({
          chainId: dto.chainId,
          destinationWallet: dto.destinationWallet ?? null,
          affectedWallets,
          totalSwept: totalSwept.toFixed(8),
          onChainExecuted: false,
        }),
      },
    });

    return {
      chainId: dto.chainId,
      destinationWallet: dto.destinationWallet ?? null,
      totalSwept: totalSwept.toFixed(8),
      affectedWallets,
      transactionIds,
      onChainExecuted: false,
    };
  }

  private async findByIdempotencyKey(idempotencyKey?: string) {
    if (!idempotencyKey) return null;
    return this.db.transaction.findUnique({
      where: { idempotencyKey },
    });
  }
}
