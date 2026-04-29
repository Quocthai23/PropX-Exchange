import { Injectable } from '@nestjs/common';
import { Prisma, $Enums } from '@prisma/client';
import Decimal from 'decimal.js';
import { BalancesService } from '@/modules/balances/services/balances.service';

@Injectable()
export class PaymentLedgerService {
  constructor(private readonly balancesService: BalancesService) {}

  async creditDeposit(
    userId: string,
    amount: Decimal,
    tx?: Prisma.TransactionClient,
  ) {
    await this.balancesService.updateBalance(userId, null, amount, 'credit', {
      tx,
    });
  }

  async lockWithdrawalFunds(userId: string, amount: Decimal) {
    await this.balancesService.transferBetweenAvailableAndLocked(
      userId,
      null,
      amount,
      'available_to_locked',
    );
  }

  async transferAvailableBalance(params: {
    tx: Prisma.TransactionClient;
    fromUserId: string;
    toUserId: string;
    amount: Decimal;
  }) {
    const { tx, fromUserId, toUserId, amount } = params;
    await this.balancesService.updateBalance(
      fromUserId,
      null,
      amount,
      'debit',
      {
        tx,
      },
    );
    await this.balancesService.updateBalance(toUserId, null, amount, 'credit', {
      tx,
    });
  }

  async applyWithdrawalStatus(params: {
    tx: Prisma.TransactionClient;
    userId: string;
    amount: Decimal;
    status: $Enums.TransactionStatus;
  }) {
    const { tx, userId, amount, status } = params;

    if (status === $Enums.TransactionStatus.COMPLETED) {
      await this.balancesService.updateBalance(userId, null, amount, 'debit', {
        useLocked: true,
        useAvailable: false,
        tx,
      });
      return;
    }

    if (
      status === $Enums.TransactionStatus.FAILED ||
      status === $Enums.TransactionStatus.CANCELLED
    ) {
      await this.balancesService.transferBetweenAvailableAndLocked(
        userId,
        null,
        amount,
        'locked_to_available',
        tx,
      );
    }
  }
}
