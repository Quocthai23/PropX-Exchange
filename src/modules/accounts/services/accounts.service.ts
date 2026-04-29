import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateAccountDto } from '../dto/accounts.dto';
import Decimal from 'decimal.js';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTypes() {
    const accountTypes = await this.prisma.accountType.findMany({
      where: { isActive: true },
    });
    return { accountTypes };
  }

  async getAccounts(userId: string, accountTypeId?: string) {
    const where: { userId: string; accountTypeId?: string } = { userId };
    if (accountTypeId) {
      where.accountTypeId = accountTypeId;
    }

    const accounts = await this.prisma.account.findMany({
      where,
      include: { accountType: true },
    });

    const accountsWithBalances = await Promise.all(
      accounts.map(async (account) => {
        const balances = await this.prisma.balance.findMany({
          where: { userId },
        });

        const totalAvailable = balances.reduce(
          (sum, b) => sum.plus(b.available.toString()),
          new Decimal(0),
        );
        const totalLocked = balances.reduce(
          (sum, b) => sum.plus(b.locked.toString()),
          new Decimal(0),
        );

        return {
          ...account,
          availableBalance: totalAvailable.toFixed(8),
          lockedBalance: totalLocked.toFixed(8),
        };
      }),
    );

    return { accounts: accountsWithBalances };
  }

  async updateAccount(userId: string, id: string, dto: UpdateAccountDto) {
    const account = await this.prisma.account.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException('account-not-found');
    }

    if (account.userId !== userId) {
      throw new ForbiddenException('not-account-owner');
    }

    const updateData: {
      name?: string;
      avatar?: string;
      leverage?: number;
      status?: string;
    } = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.avatar !== undefined) updateData.avatar = dto.avatar;
    if (dto.leverage !== undefined) updateData.leverage = dto.leverage;
    if (dto.status !== undefined) {
      const statusMap: Record<number, string> = {
        0: 'INACTIVE',
        1: 'ACTIVE',
        2: 'BANNED',
      };
      updateData.status = statusMap[dto.status] || 'ACTIVE';
    }

    const updatedAccount = await this.prisma.account.update({
      where: { id },
      data: updateData,
      include: { accountType: true },
    });

    const balances = await this.prisma.balance.findMany({
      where: { userId },
    });

    const totalAvailable = balances.reduce(
      (sum, b) => sum.plus(b.available.toString()),
      new Decimal(0),
    );
    const totalLocked = balances.reduce(
      (sum, b) => sum.plus(b.locked.toString()),
      new Decimal(0),
    );

    return {
      ...updatedAccount,
      availableBalance: totalAvailable.toFixed(8),
      lockedBalance: totalLocked.toFixed(8),
    };
  }

  async getBalance(userId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('account-not-found');
    }

    if (account.userId !== userId) {
      throw new ForbiddenException('not-account-owner');
    }

    const balances = await this.prisma.balance.findMany({
      where: { userId },
    });

    const totalAvailable = balances.reduce(
      (sum, b) => sum.plus(b.available.toString()),
      new Decimal(0),
    );

    return {
      accountId,
      currentBalance: totalAvailable.toFixed(8),
      pnl: '0',
      positionLots: [],
    };
  }

  async getAdminAccountInfo(id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: { user: true, accountType: true },
    });

    if (!account) {
      throw new NotFoundException('account-not-found');
    }

    const balances = await this.prisma.balance.findMany({
      where: { userId: account.userId },
    });

    const totalAvailable = balances.reduce(
      (sum, b) => sum.plus(b.available.toString()),
      new Decimal(0),
    );
    const totalLocked = balances.reduce(
      (sum, b) => sum.plus(b.locked.toString()),
      new Decimal(0),
    );
    const totalBalance = totalAvailable.plus(totalLocked);

    const openOrders = await this.prisma.order.count({
      where: {
        userId: account.userId,
        status: { in: ['PENDING', 'OPEN', 'PARTIALLY_FILLED'] },
      },
    });

    return {
      accountId: id,
      redis: {
        balance: totalAvailable.toFixed(8),
        equity: totalBalance.toFixed(8),
        margin: '0',
        updatedAt: new Date().toISOString(),
        marginRatio: '0',
        openPositionCount: '0',
        openOrderCount: openOrders.toString(),
      },
      db: {
        availableBalance: totalAvailable.toFixed(8),
        lockedBalance: totalLocked.toFixed(8),
        totalBalance: totalBalance.toFixed(8),
        calculatedMarginFromPositions: '0',
        positionsCount: 0,
      },
      symbolStats: [],
    };
  }
}
