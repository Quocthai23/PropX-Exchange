import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import { $Enums } from '@prisma/client';

@Injectable()
export class CorporateActionService {
  private readonly logger = new Logger(CorporateActionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dividend / Rental Yield Distribution
   * @param assetId ID of the RWA asset
   * @param totalDividend Total amount (e.g., USDT) to distribute
   */
  async distributeYield(
    assetId: string,
    totalDividend: string,
  ): Promise<number> {
    const totalDividendDec = new Decimal(totalDividend);

    // 1. Get all users currently holding this asset
    const holdings = await this.prisma.balance.findMany({
      where: {
        assetId,
        available: { gt: '0' },
      },
    });

    if (holdings.length === 0) {
      throw new BadRequestException('No users holding this asset');
    }

    // 2. Calculate the total supply currently held
    const totalSupplyHeld = holdings.reduce(
      (sum, holding) => sum.plus(holding.available),
      new Decimal(0),
    );

    let payoutCount = 0;

    // 3. Distribute funds proportionally to each user
    for (const holding of holdings) {
      const userShareRatio = new Decimal(holding.available).div(
        totalSupplyHeld,
      );
      const userPayoutAmount = totalDividendDec.times(userShareRatio);

      if (userPayoutAmount.lte(0)) continue;

      // Execute atomic transaction for each user
      await this.prisma.$transaction(async (tx) => {
        const cashBalance = await tx.balance.findFirst({
          where: { userId: holding.userId, assetId: null },
          select: { id: true },
        });

        if (cashBalance) {
          await tx.balance.update({
            where: { id: cashBalance.id },
            data: {
              available: { increment: userPayoutAmount.toString() },
            },
          });
        } else {
          await tx.balance.create({
            data: {
              userId: holding.userId,
              assetId: null,
              available: userPayoutAmount.toString(),
              locked: '0',
            },
          });
        }

        await tx.transaction.create({
          data: {
            userId: holding.userId,
            type: $Enums.TransactionType.DIVIDEND,
            amount: userPayoutAmount.toString(),
            fee: '0',
            status: $Enums.TransactionStatus.COMPLETED,
          },
        });
      });

      payoutCount++;
    }

    this.logger.log(
      `Distributed ${totalDividend} yield for asset ${assetId} to ${payoutCount} users.`,
    );
    return payoutCount;
  }

  /**
   * Process asset liquidation
   * @param assetId ID of the RWA asset
   * @param liquidationPrice Liquidation price per 1 asset unit
   */
  async liquidateAsset(
    assetId: string,
    liquidationPrice: string,
  ): Promise<void> {
    // Liquidation logic is similar to dividend distribution, but:
    // 1. Distribute USDT to users based on: Holding Amount * liquidationPrice
    // 2. Remove/Set the asset balance to 0 for all users
    // 3. Change Asset status to "LIQUIDATED" / "INACTIVE"
    // 4. Cancel all open Orders (BUY/SELL) for this Asset

    this.logger.log(
      `Starting liquidation for asset ${assetId} at price ${liquidationPrice}`,
    );

    // TODO: Implement transaction blocks for liquidation

    await this.prisma.asset.update({
      where: { id: assetId },
      data: { isActive: false },
    });
  }
}
