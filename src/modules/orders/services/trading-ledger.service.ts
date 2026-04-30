import { Injectable } from '@nestjs/common';
import { $Enums, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { BalancesService } from '@/modules/balances/services/balances.service';
import { CommissionsService } from '@/modules/commissions/commissions.service';
import { CommissionEvent } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

@Injectable()
export class TradingLedgerService {
  constructor(
    private readonly balancesService: BalancesService,
    private readonly commissionsService: CommissionsService,
  ) {}

  /**
   * Invariant: placing an order always locks funds first.
   * BUY: lock quote balance (cash)
   * SELL: lock base asset quantity
   */
  async lockOrderFunds(params: {
    tx: TxClient;
    userId: string;
    side: $Enums.OrderSide;
    assetId: string;
    quantity: Decimal;
    price: Decimal;
  }) {
    const { tx, userId, side, assetId, quantity, price } = params;
    if (side === $Enums.OrderSide.BUY) {
      const lockAmount = quantity.times(price);
      await this.balancesService.transferBetweenAvailableAndLocked(
        userId,
        null,
        lockAmount,
        'available_to_locked',
        tx,
      );
      return;
    }

    await this.balancesService.transferBetweenAvailableAndLocked(
      userId,
      assetId,
      quantity,
      'available_to_locked',
      tx,
    );
  }

  /**
   * Invariant: cancellation unlocks the remaining locked amount only.
   */
  async unlockOrderRemainder(params: {
    tx: TxClient;
    userId: string;
    side: $Enums.OrderSide;
    assetId: string;
    remainingQuantity: Decimal;
    orderPrice: Decimal;
  }) {
    const { tx, userId, side, assetId, remainingQuantity, orderPrice } = params;
    if (remainingQuantity.lte(0)) return;

    if (side === $Enums.OrderSide.BUY) {
      await this.balancesService.transferBetweenAvailableAndLocked(
        userId,
        null,
        remainingQuantity.times(orderPrice),
        'locked_to_available',
        tx,
      );
      return;
    }

    await this.balancesService.transferBetweenAvailableAndLocked(
      userId,
      assetId,
      remainingQuantity,
      'locked_to_available',
      tx,
    );
  }

  /**
   * Invariant: matched trade settles then unlocks implicitly by debiting locked legs.
   */
  async settleMatch(params: {
    tx: TxClient;
    buyerId: string;
    sellerId: string;
    assetId: string;
    quantity: Decimal;
    price: Decimal;
  }) {
    const { tx, buyerId, sellerId, assetId, quantity, price } = params;
    const quoteAmount = quantity.times(price);

    // Buyer: locked cash -> spent, available asset -> increased
    await this.balancesService.updateBalance(
      buyerId,
      null,
      quoteAmount,
      'debit',
      { useLocked: true, useAvailable: false, tx },
    );
    await this.balancesService.updateBalance(
      buyerId,
      assetId,
      quantity,
      'credit',
      { useAvailable: true, useLocked: false, tx },
    );

    // Seller: locked asset -> spent, available cash -> increased
    await this.balancesService.updateBalance(
      sellerId,
      assetId,
      quantity,
      'debit',
      { useLocked: true, useAvailable: false, tx },
    );
    await this.balancesService.updateBalance(
      sellerId,
      null,
      quoteAmount,
      'credit',
      { useAvailable: true, useLocked: false, tx },
    );

    await tx.transaction.createMany({
      data: [
        {
          userId: buyerId,
          type: $Enums.TransactionType.TRADE_BUY,
          amount: quoteAmount,
          fee: new Decimal(0),
          status: $Enums.TransactionStatus.COMPLETED,
        },
        {
          userId: sellerId,
          type: $Enums.TransactionType.TRADE_SELL,
          amount: quoteAmount,
          fee: new Decimal(0),
          status: $Enums.TransactionStatus.COMPLETED,
        },
      ],
    });

    // Trigger TRADE commissions for both buyer and seller using volume (quoteAmount)
    await Promise.all([
      this.commissionsService.triggerCommission({
        eventType: CommissionEvent.TRADE,
        sourceUserId: buyerId,
        amount: quoteAmount.toNumber(),
        sourceTxId: `${buyerId}_${assetId}_${Date.now()}`,
      }),
      this.commissionsService.triggerCommission({
        eventType: CommissionEvent.TRADE,
        sourceUserId: sellerId,
        amount: quoteAmount.toNumber(),
        sourceTxId: `${sellerId}_${assetId}_${Date.now()}`,
      })
    ]);
  }

  async refundBuyerPriceImprovement(params: {
    tx: TxClient;
    buyerId: string;
    amount: Decimal;
  }) {
    const { tx, buyerId, amount } = params;
    if (amount.lte(0)) return;

    await this.balancesService.transferBetweenAvailableAndLocked(
      buyerId,
      null,
      amount,
      'locked_to_available',
      tx,
    );
  }
}
