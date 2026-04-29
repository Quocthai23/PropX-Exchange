import { Test, TestingModule } from '@nestjs/testing';
import { DividendsService } from './dividends.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BalancesService } from '../../balances/services/balances.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  $transaction: jest.fn((fn) => fn(mockTx)),
  asset: {
    findUnique: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  dividendDistribution: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  dividendClaim: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    createMany: jest.fn(),
  },
  balance: {
    findMany: jest.fn(),
  },
  transaction: {
    create: jest.fn(),
  },
};

const mockTx = {
  dividendDistribution: {
    update: jest.fn(),
  },
  dividendClaim: {
    findUnique: jest.fn(),
    update: jest.fn(),
    createMany: jest.fn(),
  },
  balance: {
    findMany: jest.fn(),
  },
  transaction: {
    create: jest.fn(),
  },
};

const mockBalancesService = {
  updateBalance: jest.fn(),
};

describe('DividendsService', () => {
  let service: DividendsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DividendsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BalancesService, useValue: mockBalancesService },
      ],
    }).compile();

    service = module.get<DividendsService>(DividendsService);
    jest.clearAllMocks();
  });

  describe('createDistribution', () => {
    it('should throw NotFoundException if asset not found', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      await expect(
        service.createDistribution('admin-id', {
          assetId: 'asset-id',
          totalAmount: '1000',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create distribution successfully', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        id: 'asset-id',
        symbol: 'TEST',
      });
      mockPrisma.dividendDistribution.create.mockResolvedValue({
        id: 'dist-id',
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.createDistribution('admin-id', {
        assetId: 'asset-id',
        totalAmount: '1000',
      } as any);

      expect(result.id).toEqual('dist-id');
    });
  });

  describe('claimDividend', () => {
    it('should throw NotFoundException if claim not found', async () => {
      mockTx.dividendClaim.findUnique.mockResolvedValue(null);

      await expect(service.claimDividend('user-id', 'dist-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if already claimed', async () => {
      mockTx.dividendClaim.findUnique.mockResolvedValue({
        id: 'claim-id',
        status: 'CLAIMED',
        amount: '100',
      });

      await expect(service.claimDividend('user-id', 'dist-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
