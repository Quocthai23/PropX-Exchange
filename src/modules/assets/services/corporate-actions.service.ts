import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma/prisma.service';
import { DividendsService } from '@/modules/dividends/services/dividends.service';

interface CorporateActionCreateData {
  assetId: string;
  type: 'DIVIDEND' | 'LIQUIDATION' | 'DEPRECIATION';
  amount: string;
  recordDate: Date;
  executionDate: Date;
  status: string;
}

interface CorporateActionDelegate {
  create(args: { data: CorporateActionCreateData }): Promise<unknown>;
}

@Injectable()
export class CorporateActionService {
  private readonly logger = new Logger(CorporateActionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dividendsService: DividendsService,
    @InjectQueue('asset-blockchain') private readonly assetQueue: Queue,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

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
  ): Promise<{ distributionId: string; status: string }> {
    const totalDividendDec = new Decimal(totalDividend);
    if (totalDividendDec.lte(0)) {
      throw new BadRequestException('Total dividend must be greater than 0.');
    }

    const asset = await this.db.asset.findUnique({
      where: { id: assetId },
      select: { id: true },
    });
    if (!asset) {
      throw new NotFoundException('Asset not found.');
    }

    const distribution = await this.dividendsService.createDistribution(
      'SYSTEM',
      {
        assetId,
        totalAmount: Number(totalDividendDec.toString()),
      },
    );

    await this.tryRecordCorporateAction({
      assetId,
      type: 'DIVIDEND',
      amount: totalDividendDec.toString(),
      status: 'PENDING',
    });
    this.logger.log(
      `Created pull-based dividend distribution ${distribution.id}.`,
    );
    return { distributionId: distribution.id, status: 'PENDING_SNAPSHOT' };
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

    const asset = await this.db.asset.findUnique({
      where: { id: assetId },
      select: { id: true },
    });
    if (!asset) {
      throw new NotFoundException('Asset not found.');
    }

    this.logger.log(
      `Starting liquidation for asset ${assetId} at price ${liquidationPrice}`,
    );

    const holdings = await this.db.balance.findMany({
      where: {
        assetId,
        OR: [{ available: { gt: '0' } }, { locked: { gt: '0' } }],
      },
    });

    const totalHeld = holdings.reduce(
      (sum, holding) => sum.plus(holding.available).plus(holding.locked),
      new Decimal(0),
    );
    const burnAmount = totalHeld.toString();
    if (totalHeld.lte(0)) {
      throw new BadRequestException('No holdings found for liquidation.');
    }
    const burnTxHash = await this.assetQueue.add(
      'liquidation-burn',
      {
        assetId,
        liquidationPrice: liquidationPriceDec.toString(),
        burnAmount,
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    await this.tryRecordCorporateAction({
      assetId,
      type: 'LIQUIDATION',
      amount: liquidationPriceDec.toString(),
      status: 'PENDING',
    });
    this.logger.log(`Liquidation queued for ${assetId}. job=${burnTxHash.id}`);
  }
}
