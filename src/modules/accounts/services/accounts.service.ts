import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateAccountDto } from '../dto/accounts.dto';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTypes() {
    await Promise.resolve();
    // TODO: Truy vấn từ bảng AccountType trong Prisma
    return {
      accountTypes: [
        {
          id: 'account-type-standard',
          code: 'STANDARD',
          name: 'Standard Account',
          currency: 'USDT',
          description: 'Standard trading account',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
  }

  async getAccounts(userId: string, accountTypeId?: string) {
    await Promise.resolve();
    void userId;
    // TODO: Truy vấn danh sách tài khoản theo userId từ Prisma
    return {
      accounts: [
        {
          id: 'real_12345678',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          accountTypeId: accountTypeId || 'account-type-standard',
          name: 'My Trading Account',
          avatar: null,
          lockedBalance: '0',
          availableBalance: '1000',
          leverage: 100,
        },
      ],
    };
  }

  async updateAccount(userId: string, id: string, dto: UpdateAccountDto) {
    await Promise.resolve();
    void userId;
    // TODO: Kiểm tra quyền sở hữu và update dữ liệu qua Prisma
    return {
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accountTypeId: 'account-type-standard',
      name: dto.name || 'Updated Account',
      avatar: dto.avatar || null,
      lockedBalance: '0',
      availableBalance: '1000',
      leverage: dto.leverage || 100,
    };
  }

  async getBalance(userId: string, accountId: string) {
    await Promise.resolve();
    void userId;
    // TODO: Lấy balance thực tế từ DB và Redis
    return {
      accountId,
      currentBalance: '1000',
      pnl: '0',
      positionLots: [],
    };
  }

  async getAdminAccountInfo(id: string) {
    await Promise.resolve();
    // TODO: Aggregate data thực tế từ DB và Redis (So khớp lệnh)
    return {
      accountId: id,
      redis: {
        balance: '1000',
        equity: '1000',
        margin: '0',
        updatedAt: new Date().toISOString(),
        marginRatio: '0',
        openPositionCount: '0',
        openOrderCount: '0',
      },
      db: {
        availableBalance: '1000',
        lockedBalance: '0',
        totalBalance: '1000',
        calculatedMarginFromPositions: '0',
        positionsCount: 0,
      },
      symbolStats: [],
    };
  }
}
