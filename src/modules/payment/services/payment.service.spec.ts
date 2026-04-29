import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { PrismaService } from '@/prisma/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException } from '@nestjs/common';
import { PaymentLedgerService } from './payment-ledger.service';
import { PaymentTransactionHistoryService } from './payment-transaction-history.service';
import { EncryptionService } from '@/modules/auth/services/encryption.service';

const mockPrisma = {
  $transaction: jest.fn((fn) => fn(mockTx)),
  transaction: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const mockTx = {
  transaction: {
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockPaymentLedgerService = {
  creditDeposit: jest.fn(),
  lockWithdrawalFunds: jest.fn(),
  applyWithdrawalStatus: jest.fn(),
  transferAvailableBalance: jest.fn(),
};

const mockPaymentTransactionHistoryService = {
  getUserHistory: jest.fn(),
  getAdminHistory: jest.fn(),
};

const mockQueue = {
  add: jest.fn(),
};

const mockEncryptionService = {
  encrypt: jest.fn(),
};

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PaymentLedgerService, useValue: mockPaymentLedgerService },
        {
          provide: PaymentTransactionHistoryService,
          useValue: mockPaymentTransactionHistoryService,
        },
        {
          provide: getQueueToken('transaction-processing'),
          useValue: mockQueue,
        },
        { provide: EncryptionService, useValue: mockEncryptionService },
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
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return existing transaction if idempotency key exists', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'existing-tx',
      });

      const result = await service.depositDemo('user-id', {
        amount: '100',
        idempotencyKey: '00000000-0000-4000-8000-000000000000',
      } as any);

      expect(result.transactionId).toEqual('existing-tx');
      expect(result.success).toEqual(true);
      expect(mockPaymentLedgerService.creditDeposit).not.toHaveBeenCalled();
      expect(mockTx.transaction.create).not.toHaveBeenCalled();
    });

    it('should deposit demo successfully', async () => {
      mockPaymentLedgerService.creditDeposit.mockResolvedValue({});
      mockTx.transaction.create.mockResolvedValue({ id: 'tx-id' });

      const result = await service.depositDemo('user-id', {
        amount: '100',
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
