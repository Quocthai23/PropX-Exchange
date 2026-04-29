import { Test, TestingModule } from '@nestjs/testing';
import { BalancesService } from './balances.service';
import { PrismaService } from '@/prisma/prisma.service';
import Decimal from 'decimal.js';
import { BadRequestException } from '@nestjs/common';

const mockPrisma = {
  $transaction: jest.fn((fn) => fn(mockTx)),
  balance: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockTx = {
  balance: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('BalancesService', () => {
  let service: BalancesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalancesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BalancesService>(BalancesService);
    jest.clearAllMocks();
  });

  describe('updateBalance', () => {
    it('should throw BadRequestException if amount is <= 0', async () => {
      await expect(
        service.updateBalance('user-id', 'asset-id', new Decimal(0), 'credit'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateBalance(
          'user-id',
          'asset-id',
          new Decimal(-10),
          'credit',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create balance if it does not exist', async () => {
      mockTx.balance.findFirst.mockResolvedValueOnce(null);
      mockTx.balance.create.mockResolvedValue({
        id: 'balance-id',
        userId: 'user-id',
        assetId: 'asset-id',
        available: new Decimal(0),
        locked: new Decimal(0),
      });
      mockTx.balance.update.mockResolvedValue({
        id: 'balance-id',
        userId: 'user-id',
        assetId: 'asset-id',
        available: new Decimal(100),
        locked: new Decimal(0),
      });

      const result = await service.updateBalance(
        'user-id',
        'asset-id',
        new Decimal(100),
        'credit',
      );

      expect(result.available.toString()).toBe('100');
    });

    it('should credit available balance', async () => {
      mockTx.balance.findFirst.mockResolvedValueOnce({
        id: 'balance-id',
        userId: 'user-id',
        assetId: 'asset-id',
        available: new Decimal(50),
        locked: new Decimal(0),
      });
      mockTx.balance.update.mockResolvedValue({
        id: 'balance-id',
        userId: 'user-id',
        assetId: 'asset-id',
        available: new Decimal(150),
        locked: new Decimal(0),
      });

      const result = await service.updateBalance(
        'user-id',
        'asset-id',
        new Decimal(100),
        'credit',
      );

      expect(result.available.toString()).toBe('150');
    });

    it('should debit available balance', async () => {
      mockTx.balance.findFirst.mockResolvedValueOnce({
        id: 'balance-id',
        userId: 'user-id',
        assetId: 'asset-id',
        available: new Decimal(100),
        locked: new Decimal(0),
      });
      mockTx.balance.update.mockResolvedValue({
        id: 'balance-id',
        userId: 'user-id',
        assetId: 'asset-id',
        available: new Decimal(50),
        locked: new Decimal(0),
      });

      const result = await service.updateBalance(
        'user-id',
        'asset-id',
        new Decimal(50),
        'debit',
      );

      expect(result.available.toString()).toBe('50');
    });

    it('should throw BadRequestException if insufficient balance', async () => {
      mockTx.balance.findFirst.mockResolvedValueOnce({
        id: 'balance-id',
        userId: 'user-id',
        assetId: 'asset-id',
        available: new Decimal(50),
        locked: new Decimal(0),
      });

      await expect(
        service.updateBalance('user-id', 'asset-id', new Decimal(100), 'debit'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('transferBetweenAvailableAndLocked', () => {
    it('should throw BadRequestException if amount <= 0', async () => {
      await expect(
        service.transferBetweenAvailableAndLocked(
          'user-id',
          'asset-id',
          new Decimal(0),
          'available_to_locked',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if balance not found', async () => {
      mockTx.balance.findFirst.mockResolvedValue(null);

      await expect(
        service.transferBetweenAvailableAndLocked(
          'user-id',
          'asset-id',
          new Decimal(100),
          'available_to_locked',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should transfer from available to locked', async () => {
      mockTx.balance.findFirst.mockResolvedValue({
        id: 'balance-id',
        userId: 'user-id',
        assetId: 'asset-id',
        available: new Decimal(100),
        locked: new Decimal(0),
      });
      mockTx.balance.update.mockResolvedValue({
        id: 'balance-id',
        userId: 'user-id',
        assetId: 'asset-id',
        available: new Decimal(50),
        locked: new Decimal(50),
      });

      const result = await service.transferBetweenAvailableAndLocked(
        'user-id',
        'asset-id',
        new Decimal(50),
        'available_to_locked',
      );

      expect(result.available.toString()).toBe('50');
      expect(result.locked.toString()).toBe('50');
    });

    it('should transfer from locked to available', async () => {
      mockTx.balance.findFirst.mockResolvedValue({
        id: 'balance-id',
        userId: 'user-id',
        assetId: 'asset-id',
        available: new Decimal(0),
        locked: new Decimal(100),
      });
      mockTx.balance.update.mockResolvedValue({
        id: 'balance-id',
        userId: 'user-id',
        assetId: 'asset-id',
        available: new Decimal(50),
        locked: new Decimal(50),
      });

      const result = await service.transferBetweenAvailableAndLocked(
        'user-id',
        'asset-id',
        new Decimal(50),
        'locked_to_available',
      );

      expect(result.available.toString()).toBe('50');
      expect(result.locked.toString()).toBe('50');
    });
  });

  describe('getBalances', () => {
    it('should return user balances', async () => {
      const mockBalances = [
        { id: 'balance-1', userId: 'user-id', assetId: 'asset-1' },
      ];
      mockPrisma.balance.findMany.mockResolvedValue(mockBalances);

      const result = await service.getBalances('user-id');

      expect(result).toEqual(mockBalances);
    });
  });

  describe('getBalance', () => {
    it('should return single balance', async () => {
      const mockBalance = {
        id: 'balance-1',
        userId: 'user-id',
        assetId: 'asset-1',
      };
      mockPrisma.balance.findFirst.mockResolvedValue(mockBalance);

      const result = await service.getBalance('user-id', 'asset-1');

      expect(result).toEqual(mockBalance);
    });
  });
});
