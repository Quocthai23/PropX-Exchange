import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma/prisma.service';

type DecimalValue = string | number | { toString(): string };

export interface PortfolioPosition {
  assetId: string;
  symbol: string;
  name: string;
  quantity: string;
  marketPrice: string;
  marketValue: string;
  expectedApy: string;
  annualYieldEstimate: string;
}

@Injectable()
export class UserPortfolioService {
  constructor(private readonly prisma: PrismaService) {}

  private toDecimalString(value: DecimalValue): string {
    return typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : value.toString();
  }

  async getPortfolioOverview(userId: string) {
    const [balances, dividendAggregate] = await Promise.all([
      this.prisma.balance.findMany({
        where: { userId },
        select: {
          assetId: true,
          available: true,
          locked: true,
        },
      }),
      this.prisma.transaction.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
          type: 'DIVIDEND',
        },
        _sum: { amount: true },
      }),
    ]);

    const stablecoinBalance = balances
      .filter((balance) => !balance.assetId || balance.assetId === '')
      .reduce(
        (sum, balance) =>
          sum
            .plus(balance.available.toString())
            .plus(balance.locked.toString()),
        new Decimal(0),
      );

    const rwaBalances = balances.filter(
      (balance) => balance.assetId && balance.assetId !== '',
    );

    const assetIds = [
      ...new Set(rwaBalances.map((balance) => balance.assetId!)),
    ];
    const assets =
      assetIds.length > 0
        ? await this.prisma.asset.findMany({
            where: { id: { in: assetIds } },
            select: {
              id: true,
              symbol: true,
              name: true,
              tokenPrice: true,
              referencePrice: true,
              expectedApy: true,
            },
          })
        : [];

    const assetMap = new Map(assets.map((asset) => [asset.id, asset]));

    const latestPriceEntries = await Promise.all(
      assetIds.map(async (assetId) => {
        const latestFilledOrder = await this.prisma.order.findFirst({
          where: {
            assetId,
            price: { not: null },
            status: { in: ['FILLED', 'PARTIALLY_FILLED'] },
          },
          orderBy: { updatedAt: 'desc' },
          select: { price: true },
        });

        const fallbackPrice = assetMap.get(assetId)?.tokenPrice;
        const marketPrice = latestFilledOrder?.price ?? fallbackPrice ?? '0';

        return [
          assetId,
          new Decimal(this.toDecimalString(marketPrice)),
        ] as const;
      }),
    );

    const latestPriceMap = new Map(latestPriceEntries);

    const positions: PortfolioPosition[] = [];
    let totalRwaValue = new Decimal(0);
    let totalRwaReferenceValue = new Decimal(0);
    let totalApyWeightedValue = new Decimal(0);
    let estimatedAnnualYield = new Decimal(0);

    for (const holding of rwaBalances) {
      const assetId = holding.assetId;
      if (!assetId) continue;

      const asset = assetMap.get(assetId);
      if (!asset) continue;

      const quantity = new Decimal(
        this.toDecimalString(holding.available),
      ).plus(this.toDecimalString(holding.locked));

      if (quantity.lte(0)) continue;

      const marketPrice = latestPriceMap.get(assetId) ?? new Decimal(0);
      const marketValue = quantity.mul(marketPrice);
      const referencePrice = new Decimal(
        this.toDecimalString(asset.referencePrice ?? marketPrice),
      );
      const referenceValue = quantity.mul(referencePrice);
      const apy = new Decimal(this.toDecimalString(asset.expectedApy ?? 0));
      const annualYieldForAsset = marketValue.mul(apy).div(100);

      totalRwaValue = totalRwaValue.plus(marketValue);
      totalRwaReferenceValue = totalRwaReferenceValue.plus(referenceValue);
      totalApyWeightedValue = totalApyWeightedValue.plus(marketValue.mul(apy));
      estimatedAnnualYield = estimatedAnnualYield.plus(annualYieldForAsset);

      positions.push({
        assetId,
        symbol: asset.symbol,
        name: asset.name,
        quantity: quantity.toFixed(8),
        marketPrice: marketPrice.toFixed(8),
        marketValue: marketValue.toFixed(8),
        expectedApy: apy.toFixed(4),
        annualYieldEstimate: annualYieldForAsset.toFixed(8),
      });
    }

    const [depositAggregate, withdrawAggregate] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
          type: 'DEPOSIT',
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
          type: 'WITHDRAW',
        },
        _sum: { amount: true },
      }),
    ]);

    const totalDepositAmount = new Decimal(
      this.toDecimalString(depositAggregate._sum.amount ?? 0),
    );
    const totalWithdrawAmount = new Decimal(
      this.toDecimalString(withdrawAggregate._sum.amount ?? 0),
    );
    const netDepositedCapital = totalDepositAmount.minus(totalWithdrawAmount);

    const totalPortfolioValue = stablecoinBalance.plus(totalRwaValue);
    const pnl = totalPortfolioValue.minus(netDepositedCapital);
    const pnlPercent = netDepositedCapital.gt(0)
      ? pnl.div(netDepositedCapital).mul(100)
      : new Decimal(0);

    const weightedApy = totalRwaValue.gt(0)
      ? totalApyWeightedValue.div(totalRwaValue)
      : new Decimal(0);
    const totalDividendsReceived = new Decimal(
      this.toDecimalString(dividendAggregate._sum.amount ?? 0),
    );

    return {
      asOf: new Date().toISOString(),
      stablecoinBalance: stablecoinBalance.toFixed(8),
      rwaMarketValue: totalRwaValue.toFixed(8),
      rwaReferenceValue: totalRwaReferenceValue.toFixed(8),
      totalPortfolioValue: totalPortfolioValue.toFixed(8),
      netDepositedCapital: netDepositedCapital.toFixed(8),
      pnl: pnl.toFixed(8),
      pnlPercent: pnlPercent.toFixed(4),
      estimatedApy: weightedApy.toFixed(4),
      estimatedAnnualYield: estimatedAnnualYield.toFixed(8),
      totalDividendsReceived: totalDividendsReceived.toFixed(8),
      positions,
    };
  }
}
