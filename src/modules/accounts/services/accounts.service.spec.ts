import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import Decimal from 'decimal.js';

const mockPrisma = {
  accountType: {
    findMany: jest.fn(),
  },
  account: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  balance: {
    findMany: jest.fn(),
  },
  order: {
    count: jest.fn(),
  },
};

describe('AccountsService', () => {
  let service: AccountsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    jest.clearAllMocks();
  });

  describe('getTypes', () => {
    it('should return active account types', async () => {
      const mockTypes = [{ id: 'type-id', code: 'REAL', name: 'Real Account' }];
      mockPrisma.accountType.findMany.mockResolvedValue(mockTypes);

      const result = await service.getTypes();

      expect(result).toEqual({ accountTypes: mockTypes });
      expect(mockPrisma.accountType.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });
  });

  describe('getAccounts', () => {
    it('should return user accounts with balances', async () => {
      const mockAccounts = [
        {
          id: 'account-id',
          userId: 'user-id',
          name: 'Test Account',
          accountType: { id: 'type-id', code: 'REAL' },
        },
      ];
      const mockBalances = [
        { available: new Decimal('100'), locked: new Decimal('50') },
      ];

      mockPrisma.account.findMany.mockResolvedValue(mockAccounts);
      mockPrisma.balance.findMany.mockResolvedValue(mockBalances);

      const result = await service.getAccounts('user-id');

      expect(result.accounts).toHaveLength(1);
      expect(result.accounts[0].availableBalance).toBe('100.00000000');
      expect(result.accounts[0].lockedBalance).toBe('50.00000000');
    });
  });

  describe('updateAccount', () => {
    it('should throw NotFoundException if account not found', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.updateAccount('user-id', 'account-id', {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not account owner', async () => {
      mockPrisma.account.findUnique.mockResolvedValue({
        id: 'account-id',
        userId: 'other-user-id',
      });

      await expect(
        service.updateAccount('user-id', 'account-id', {} as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update account successfully', async () => {
      const mockAccount = {
        id: 'account-id',
        userId: 'user-id',
        name: 'Old Name',
        accountType: { id: 'type-id', code: 'REAL' },
      };
      const updateDto = { name: 'New Name' };

      mockPrisma.account.findUnique.mockResolvedValue(mockAccount);
      mockPrisma.account.update.mockResolvedValue({
        ...mockAccount,
        name: 'New Name',
      });
      mockPrisma.balance.findMany.mockResolvedValue([]);

      const result = await service.updateAccount(
        'user-id',
        'account-id',
        updateDto as any,
      );

      expect(result.name).toBe('New Name');
    });
  });
});
