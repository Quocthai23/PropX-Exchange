import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/accounts.dto';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { userId },
      include: { accountType: true },
      orderBy: { createdAt: 'desc' },
    });

    const balance = await this.prisma.balance.findFirst({
      where: {
        userId,
        assetId: null,
      },
    });

    return accounts.map((account) => ({
      ...account,
      availableBalance: balance?.available?.toString() || '0',
      lockedBalance: balance?.locked?.toString() || '0',
      balance: (Number(balance?.available || 0) + Number(balance?.locked || 0)).toString(),
    }));
  }

  async getTypes() {
    return this.prisma.accountType.findMany({
      where: { isActive: true },
    });
  }

  async create(userId: string, dto: CreateAccountDto) {
    const accountType = await this.prisma.accountType.findUnique({
      where: { id: dto.accountTypeId },
    });

    if (!accountType) {
      throw new NotFoundException('Account type not found');
    }

    return this.prisma.account.create({
      data: {
        userId,
        accountTypeId: dto.accountTypeId,
        name: dto.name,
        status: 'ACTIVE',
      },
      include: { accountType: true },
    });
  }

  async update(userId: string, id: string, dto: UpdateAccountDto) {
    const account = await this.prisma.account.findUnique({
      where: { id },
    });

    if (!account || account.userId !== userId) {
      throw new NotFoundException('Account not found');
    }

    return this.prisma.account.update({
      where: { id },
      data: dto,
      include: { accountType: true },
    });
  }

  async remove(userId: string, id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
    });

    if (!account || account.userId !== userId) {
      throw new NotFoundException('Account not found');
    }

    await this.prisma.account.delete({
      where: { id },
    });

    return { success: true };
  }

  async getBalance(userId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { accountType: true },
    });

    if (!account || account.userId !== userId) {
      throw new NotFoundException('Account not found');
    }

    // Fetch primary balance (assetId: null represents system base currency like USDT)
    const balance = await this.prisma.balance.findFirst({
      where: {
        userId,
        assetId: null,
      },
    });

    return {
      accountId: account.id,
      currentBalance: balance?.available.toString() || '0',
      pnl: '0',
      positionLots: [],
    };
  }
}
