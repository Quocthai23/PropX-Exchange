import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import Decimal from 'decimal.js';

@Injectable()
export class BalancesService {
  constructor(private readonly prisma: PrismaService) {}

  async updateBalance(
    userId: string,
    assetId: string | null,
    amount: Decimal,
    type: 'credit' | 'debit',
    options?: {
      useAvailable?: boolean;
      useLocked?: boolean;
      description?: string;
    },
  ) {
    const { useAvailable = true, useLocked = false } = options || {};

    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    return this.prisma.$transaction(
      async (tx) => {
        let balance = await tx.balance.findFirst({
          where: { userId, assetId },
        });

        if (!balance) {
          balance = await tx.balance.create({
            data: {
              userId,
              assetId,
              available: new Decimal(0),
              locked: new Decimal(0),
            },
          });
        }

        let newAvailable = new Decimal(balance.available.toString());
        let newLocked = new Decimal(balance.locked.toString());

        if (type === 'credit') {
          if (useAvailable) {
            newAvailable = newAvailable.plus(amount);
          }
          if (useLocked) {
            newLocked = newLocked.plus(amount);
          }
        } else if (type === 'debit') {
          if (useAvailable) {
            if (newAvailable.lessThan(amount)) {
              throw new BadRequestException('Insufficient available balance');
            }
            newAvailable = newAvailable.minus(amount);
          }
          if (useLocked) {
            if (newLocked.lessThan(amount)) {
              throw new BadRequestException('Insufficient locked balance');
            }
            newLocked = newLocked.minus(amount);
          }
        }

        return tx.balance.update({
          where: { id: balance.id },
          data: {
            available: newAvailable,
            locked: newLocked,
          },
        });
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
  ) {
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const balance = await tx.balance.findFirst({
          where: { userId, assetId },
        });

        if (!balance) {
          throw new BadRequestException('Balance not found');
        }

        let newAvailable = new Decimal(balance.available.toString());
        let newLocked = new Decimal(balance.locked.toString());

        if (direction === 'available_to_locked') {
          if (newAvailable.lessThan(amount)) {
            throw new BadRequestException('Insufficient available balance');
          }
          newAvailable = newAvailable.minus(amount);
          newLocked = newLocked.plus(amount);
        } else {
          if (newLocked.lessThan(amount)) {
            throw new BadRequestException('Insufficient locked balance');
          }
          newLocked = newLocked.minus(amount);
          newAvailable = newAvailable.plus(amount);
        }

        return tx.balance.update({
          where: { id: balance.id },
          data: {
            available: newAvailable,
            locked: newLocked,
          },
        });
      },
      {
        isolationLevel: 'Serializable',
      },
    );
  }
}
