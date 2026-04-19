import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../prisma/prisma.service';

type CorporateActionCreateData = {
  assetId: string;
  type: 'DIVIDEND' | 'LIQUIDATION' | 'DEPRECIATION';
  amount: string;
  recordDate: Date;
  executionDate: Date;
  status: string;
};

type CorporateActionDelegate = {
  create(args: { data: CorporateActionCreateData }): Promise<unknown>;
};

@Injectable()
export class CorporateActionService {
  private readonly logger = new Logger(CorporateActionService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async tryRecordCorporateAction(data: {
    assetId: string;
    type: 'DIVIDEND' | 'LIQUIDATION' | 'DEPRECIATION';
    amount: string;
    status: string;
  }) {
    const prisma = this.prisma as PrismaService & {
      corporateAction: CorporateActionDelegate;
    };

    await prisma.corporateAction.create({
      data: {
        assetId: data.assetId,
        type: data.type,
        amount: data.amount,
        recordDate: new Date(),
        executionDate: new Date(),
        status: data.status,
      },
    });
  }

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
    if (totalDividendDec.lte(0)) {
      throw new BadRequestException('Total dividend must be greater than 0.');
    }

    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true },
    });
    if (!asset) {
      throw new NotFoundException('Asset not found.');
    }

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
        });

        if (cashBalance) {
          await tx.balance.update({
            where: { id: cashBalance.id },
            data: {
              available: {
                increment: userPayoutAmount.toString(),
              },
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
            type: 'DIVIDEND_PAYOUT',
            amount: userPayoutAmount.toString(),
            fee: '0',
            status: 'COMPLETED',
          },
        });
      });

      payoutCount++;
    }

    await this.tryRecordCorporateAction({
      assetId,
      type: 'DIVIDEND',
      amount: totalDividendDec.toString(),
      status: 'COMPLETED',
    });

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
    const liquidationPriceDec = new Decimal(liquidationPrice);
    if (liquidationPriceDec.lte(0)) {
      throw new BadRequestException(
        'Liquidation price must be greater than 0.',
      );
    }

    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true },
    });
    if (!asset) {
      throw new NotFoundException('Asset not found.');
    }

    this.logger.log(
      `Starting liquidation for asset ${assetId} at price ${liquidationPrice}`,
    );

    const holdings = await this.prisma.balance.findMany({
      where: {
        assetId,
        OR: [{ available: { gt: '0' } }, { locked: { gt: '0' } }],
      },
    });

    for (const holding of holdings) {
      const totalHeld = new Decimal(holding.available).plus(holding.locked);
      if (totalHeld.lte(0)) {
        continue;
      }

      const payoutAmount = totalHeld.mul(liquidationPriceDec);

      await this.prisma.$transaction(async (tx) => {
        const cashBalance = await tx.balance.findFirst({
          where: { userId: holding.userId, assetId: null },
        });

        if (cashBalance) {
          await tx.balance.update({
            where: { id: cashBalance.id },
            data: {
              available: {
                increment: payoutAmount.toString(),
              },
            },
          });
        } else {
          await tx.balance.create({
            data: {
              userId: holding.userId,
              assetId: null,
              available: payoutAmount.toString(),
              locked: '0',
            },
          });
        }

        await tx.balance.update({
          where: { id: holding.id },
          data: {
            available: '0',
            locked: '0',
          },
        });

        await tx.transaction.create({
          data: {
            userId: holding.userId,
            type: 'LIQUIDATION_PAYOUT',
            amount: payoutAmount.toString(),
            fee: '0',
            status: 'COMPLETED',
          },
        });
      });
    }

    await this.prisma.$transaction([
      this.prisma.order.updateMany({
        where: {
          assetId,
          status: { in: ['OPEN', 'PARTIAL'] },
        },
        data: { status: 'CANCELLED' },
      }),
      this.prisma.asset.update({
        where: { id: assetId },
        data: { isActive: false },
      }),
    ]);

    await this.tryRecordCorporateAction({
      assetId,
      type: 'LIQUIDATION',
      amount: liquidationPriceDec.toString(),
      status: 'COMPLETED',
    });
  }
}
