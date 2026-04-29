import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { BalancesService } from '../../balances/services/balances.service';
import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  $transaction: jest.fn((fn) => fn(mockTx)),
  transaction: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  account: {
    findUnique: jest.fn(),
  },
};

const mockTx = {
  transaction: {
    update: jest.fn(),
  },
};

const mockBalancesService = {
  updateBalance: jest.fn(),
};

const mockQueue = {
  add: jest.fn(),
};

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BalancesService, useValue: mockBalancesService },
        {
          provide: getQueueToken('transaction-processing'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    jest.clearAllMocks();
  });

  describe('depositDemo', () => {
    it('should throw BadRequestException if amount <=0', async () => {
      await expect(
        service.depositDemo('user-id', {
          amount: '0',
          accountId: 'account-id',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if account not found', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.depositDemo('user-id', {
          amount: '100',
          accountId: 'account-id',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if not account owner', async () => {
      mockPrisma.account.findUnique.mockResolvedValue({
        id: 'account-id',
        userId: 'other-user-id',
      });

      await expect(
        service.depositDemo('user-id', {
          amount: '100',
          accountId: 'account-id',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should deposit demo successfully', async () => {
      mockPrisma.account.findUnique.mockResolvedValue({
        id: 'account-id',
        userId: 'user-id',
      });
      mockBalancesService.updateBalance.mockResolvedValue({});
      mockPrisma.transaction.create.mockResolvedValue({ id: 'tx-id' });

      const result = await service.depositDemo('user-id', {
        amount: '100',
        accountId: 'account-id',
      } as any);

      expect(result.transactionId).toEqual('tx-id');
      expect(result.success).toEqual(true);
    });
  });

  describe('processWithdrawal', () => {
    it('should return existing transaction if idempotency key exists', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'existing-tx-id',
      });

      const result = await service.processWithdrawal('user-id', {
        idempotencyKey: 'test-key',
        amount: '100',
        accountId: 'account-id',
        destinationAddress: '0x123',
        chainId: 1,
      } as any);

      expect(result.transactionId).toEqual('existing-tx-id');
    });
  });
});
