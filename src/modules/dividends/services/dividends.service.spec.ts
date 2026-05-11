import { Test, TestingModule } from '@nestjs/testing';
import { DividendsService } from './dividends.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BalancesService } from '../../balances/services/balances.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommissionsService } from '../../commissions/commissions.service';
import { getQueueToken } from '@nestjs/bullmq';
import { ethers } from 'ethers';
import { CreateDistributionDto } from '../dto/create-distribution.dto';

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
        { provide: CommissionsService, useValue: {} },
        { provide: getQueueToken('merkle-tree'), useValue: {} },
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
        } as CreateDistributionDto),
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
      } as CreateDistributionDto);

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

  describe('getClaimProof', () => {
    it('should generate valid merkle proof using ethers keccak256', async () => {
      const distributionId = 'dist-1';
      const user1 = {
        id: 'user-1',
        walletAddress: '0x1234567890123456789012345678901234567890',
      };
      const user2 = {
        id: 'user-2',
        walletAddress: '0x0987654321098765432109876543210987654321',
      };

      const claims = [
        { userId: user1.id, amount: '100.5', user: user1 },
        { userId: user2.id, amount: '200.0', user: user2 },
      ];

      mockPrisma.dividendClaim.findMany.mockResolvedValue(claims);

      const result = await service.getClaimProof(user1.id, distributionId);

      expect(result.distributionId).toBe(distributionId);
      expect(result.userId).toBe(user1.id);
      expect(result.amount).toBe('100.5');
      expect(result.merkleRoot).toBeDefined();
      expect(result.proof.length).toBeGreaterThan(0);

      // Verify the hashing logic manually
      const amount1Wei = ethers.parseUnits('100.500000', 6).toString();
      const amount2Wei = ethers.parseUnits('200.000000', 6).toString();

      const leaf1 = ethers.solidityPackedKeccak256(
        ['address', 'uint256'],
        [user1.walletAddress, amount1Wei],
      );
      const leaf2 = ethers.solidityPackedKeccak256(
        ['address', 'uint256'],
        [user2.walletAddress, amount2Wei],
      );

      const [a, b] = [leaf1, leaf2].sort();
      const expectedRoot = ethers.solidityPackedKeccak256(
        ['bytes32', 'bytes32'],
        [a, b],
      );

      expect(result.merkleRoot).toBe(expectedRoot);
    });

    it('should use a zero address fallback if user lacks wallet address', async () => {
      const claims = [
        { userId: 'user-1', amount: '100.0', user: { walletAddress: null } },
      ];
      mockPrisma.dividendClaim.findMany.mockResolvedValue(claims);

      const result = await service.getClaimProof('user-1', 'dist-1');

      const expectedAmountWei = ethers.parseUnits('100.000000', 6).toString();
      const expectedRoot = ethers.solidityPackedKeccak256(
        ['address', 'uint256'],
        ['0x0000000000000000000000000000000000000000', expectedAmountWei],
      );

      expect(result.merkleRoot).toBe(expectedRoot);
    });
  });
});
