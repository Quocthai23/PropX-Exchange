import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma, TransactionType, TransactionStatus } from '@prisma/client';
import Decimal from 'decimal.js';

export interface TransactionData {
  type: TransactionType;
  status: TransactionStatus;
  fee?: Decimal;
  idempotencyKey?: string;
  txHash?: string;
}

@Injectable()
export class BalancesService {
  constructor(private readonly prisma: PrismaService) {}

  async updateBalance(
    userId: string,
    assetId: string | null,
    amount: Decimal,
    type: 'credit' | 'debit',
    transactionData: TransactionData,
    options?: {
      useAvailable?: boolean;
      useLocked?: boolean;
      description?: string;
      tx?: Prisma.TransactionClient;
    },
  ) {
    const { useAvailable = true, useLocked = false, tx } = options || {};

    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const mutate = async (txClient: Prisma.TransactionClient) => {
      let balance = await txClient.balance.findFirst({
        where: { userId, assetId },
      });

      if (!balance) {
        if (type === 'debit') {
          throw new BadRequestException('Insufficient balance');
        }
        balance = await txClient.balance.create({
          data: {
            userId,
            assetId,
            available: new Decimal(0),
            locked: new Decimal(0),
          },
        });
      }

      const updateData: any = {};

      if (type === 'credit') {
        if (useAvailable) {
          updateData.available = { increment: amount.toString() };
        }
        if (useLocked) {
          updateData.locked = { increment: amount.toString() };
        }
      } else if (type === 'debit') {
        if (useAvailable) {
          if (new Decimal(balance.available.toString()).lessThan(amount)) {
            throw new BadRequestException('Insufficient available balance');
          }
          updateData.available = { decrement: amount.toString() };
        }
        if (useLocked) {
          if (new Decimal(balance.locked.toString()).lessThan(amount)) {
            throw new BadRequestException('Insufficient locked balance');
          }
          updateData.locked = { decrement: amount.toString() };
        }
      }

      const updatedBalance = await txClient.balance.update({
        where: { id: balance.id },
        data: updateData,
      });

      await txClient.transaction.create({
        data: {
          userId,
          type: transactionData.type,
          amount,
          fee: transactionData.fee || new Decimal(0),
          status: transactionData.status,
          idempotencyKey: transactionData.idempotencyKey,
          txHash: transactionData.txHash,
        },
      });

      return updatedBalance;
    };

    if (tx) {
      return mutate(tx);
    }

    return this.prisma.$transaction(
      async (tx) => {
        return mutate(tx);
      },
      {
        isolationLevel: 'Serializable',
      },
    );
  }

  async getBalances(userId: string) {
    return this.prisma.balance.findMany({
      where: { userId },
      include: { asset: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBalance(userId: string, assetId: string | null) {
    return this.prisma.balance.findFirst({
      where: { userId, assetId },
      include: { asset: true },
    });
  }

  async transferBetweenAvailableAndLocked(
    userId: string,
    assetId: string | null,
    amount: Decimal,
    direction: 'available_to_locked' | 'locked_to_available',
    tx?: Prisma.TransactionClient,
  ) {
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const mutate = async (txClient: Prisma.TransactionClient) => {
      const balance = await txClient.balance.findFirst({
        where: { userId, assetId },
      });

      if (!balance) {
        throw new BadRequestException('Balance not found');
      }

      const updateData: any = {};

      if (direction === 'available_to_locked') {
        if (new Decimal(balance.available.toString()).lessThan(amount)) {
          throw new BadRequestException('Insufficient available balance');
        }
        updateData.available = { decrement: amount.toString() };
        updateData.locked = { increment: amount.toString() };
      } else {
        if (new Decimal(balance.locked.toString()).lessThan(amount)) {
          throw new BadRequestException('Insufficient locked balance');
        }
        updateData.locked = { decrement: amount.toString() };
        updateData.available = { increment: amount.toString() };
      }

      return txClient.balance.update({
        where: { id: balance.id },
        data: updateData,
      });
    };

    if (tx) {
      return mutate(tx);
    }

    return this.prisma.$transaction(
      async (tx) => {
        return mutate(tx);
      },
      {
        isolationLevel: 'Serializable',
      },
    );
  }
}
