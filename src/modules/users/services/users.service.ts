import { Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateProfileDto, UpdateReferralDto } from '../dto/update-user.dto';
import {
  ToggleFavoriteAssetDto,
  UpsertRelationDto,
} from '../dto/create-user.dto';

type DecimalValue = string | number | { toString(): string };

type PortfolioPosition = {
  assetId: string;
  symbol: string;
  name: string;
  quantity: string;
  marketPrice: string;
  marketValue: string;
  expectedApy: string;
  annualYieldEstimate: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  healthCheck() {
    return { message: 'Users module is running.' };
  }

  async getPublicProfile(
    id: string,
    currentUserId?: string,
  ): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('user-not-found');

    // Sử dụng currentUserId để giả lập check relation
    const isFollowing = currentUserId ? false : false;

    return {
      ...user,
      status: 1, // mock do schema.prisma chưa có
      avatar: null, // mock
      gender: null, // mock
      followerCount: 0,
      followingCount: 0,
      isFollowing,
      isBlocking: false,
      isBlockedBy: false,
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<{ success: boolean }> {
    const updateData: Record<string, string> = {};
    // Hiện Prisma Schema chỉ có trường username, lọc các trường khác ra để không lỗi Prisma
    if (dto.username) updateData.username = dto.username;

    if (Object.keys(updateData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }
    return { success: true };
  }

  async getMyProfile(userId: string): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('user-not-found');
    // Mock thêm các trường Schema chưa có mà Swagger yêu cầu
    return {
      ...user,
      status: 1,
      avatar: null,
      gender: null,
      referenceCode: 'MOCK-REF',
      hasPassword: true,
      enabledMfa: false,
    };
  }

  async softDeleteAccount(userId: string): Promise<{ success: boolean }> {
    // TODO: Schema.prisma hiện tại chưa có trường status, chờ Cập nhật DB
    await Promise.resolve(userId);
    return { success: true };
  }

  async getSuggestions(
    userId: string,
    take: number,
  ): Promise<Record<string, unknown>[]> {
    // TODO: Query active users sorted by follower count
    await Promise.resolve({ userId, take }); // Xóa lỗi "has no 'await' expression"
    return [];
  }

  async getRelations(
    targetUserId: string,
    relationType: string,
    skip: number,
    take: number,
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    // TODO: Query followings/followers
    await Promise.resolve({ targetUserId, relationType, skip, take });
    return { data: [], total: 0 };
  }

  async toggleFavoriteAsset(
    userId: string,
    dto: ToggleFavoriteAssetDto,
  ): Promise<{ isFavorite: boolean }> {
    // TODO: Add/remove to favorite logic
    await Promise.resolve({ userId, dto });
    return { isFavorite: true };
  }

  async upsertRelation(
    currentUserId: string,
    targetUserId: string,
    dto: UpsertRelationDto,
  ): Promise<{
    isFollowing: boolean;
    isBlocking: boolean;
    isBlockedBy: boolean;
  }> {
    await Promise.resolve({ currentUserId, targetUserId, dto });
    return { isFollowing: true, isBlocking: false, isBlockedBy: false };
  }

  async updateReferral(
    userId: string,
    dto: UpdateReferralDto,
  ): Promise<{ success: boolean }> {
    await Promise.resolve({ userId, dto });
    return { success: true };
  }

  async getPortfolioOverview(userId: string) {
    const [balances, cashflowTransactions] = await Promise.all([
      this.prisma.balance.findMany({
        where: { userId },
        select: {
          assetId: true,
          available: true,
          locked: true,
        },
      }),
      this.prisma.transaction.findMany({
        where: {
          userId,
          status: 'COMPLETED',
          type: { in: ['DEPOSIT', 'WITHDRAW'] },
        },
        select: {
          type: true,
          amount: true,
        },
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
            status: { in: ['FILLED', 'PARTIAL'] },
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
      const apy = new Decimal(this.toDecimalString(asset.expectedApy ?? 0));
      const annualYieldForAsset = marketValue.mul(apy).div(100);

      totalRwaValue = totalRwaValue.plus(marketValue);
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

    const netDepositedCapital = cashflowTransactions.reduce((sum, tx) => {
      const amount = new Decimal(this.toDecimalString(tx.amount));
      if (tx.type === 'DEPOSIT') return sum.plus(amount);
      if (tx.type === 'WITHDRAW') return sum.minus(amount);
      return sum;
    }, new Decimal(0));

    const totalPortfolioValue = stablecoinBalance.plus(totalRwaValue);
    const pnl = totalPortfolioValue.minus(netDepositedCapital);
    const pnlPercent = netDepositedCapital.gt(0)
      ? pnl.div(netDepositedCapital).mul(100)
      : new Decimal(0);

    const weightedApy = totalRwaValue.gt(0)
      ? totalApyWeightedValue.div(totalRwaValue)
      : new Decimal(0);

    return {
      asOf: new Date().toISOString(),
      stablecoinBalance: stablecoinBalance.toFixed(8),
      rwaMarketValue: totalRwaValue.toFixed(8),
      totalPortfolioValue: totalPortfolioValue.toFixed(8),
      netDepositedCapital: netDepositedCapital.toFixed(8),
      pnl: pnl.toFixed(8),
      pnlPercent: pnlPercent.toFixed(4),
      estimatedApy: weightedApy.toFixed(4),
      estimatedAnnualYield: estimatedAnnualYield.toFixed(8),
      positions,
    };
  }

  private toDecimalString(value: DecimalValue): string {
    return typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : value.toString();
  }
}
