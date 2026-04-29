import { Test, TestingModule } from '@nestjs/testing';
import { KycService } from './kyc.service';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { MultiSigService } from '@/shared/services/multisig.service';

const mockPrisma = {
  $transaction: jest.fn(),
  kycRecord: {
    upsert: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
};

const mockNotificationsService = {
  createNotification: jest.fn(),
};

const mockQueue = {
  add: jest.fn(),
};

const mockBlockchainService = {
  addToWhitelist: jest.fn(),
};

const mockMultiSigService = {
  createProposal: jest.fn(),
  approve: jest.fn(),
};

describe('KycService', () => {
  let service: KycService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: getQueueToken('kyc-approval'), useValue: mockQueue },
        { provide: BlockchainService, useValue: mockBlockchainService },
        { provide: MultiSigService, useValue: mockMultiSigService },
      ],
    }).compile();

    service = module.get<KycService>(KycService);
    jest.clearAllMocks();
    mockMultiSigService.createProposal.mockResolvedValue({
      proposalId: 'proposal-1',
    });
    mockMultiSigService.approve.mockResolvedValue({
      proposalId: 'proposal-1',
      status: 'PENDING',
      approvals: ['admin-id'],
      requiredApprovals: 3,
      payload: {},
    });
    mockBlockchainService.addToWhitelist.mockResolvedValue({ txHash: '0xabc' });
  });

  describe('submitKyc', () => {
    it('should submit KYC successfully and create audit log', async () => {
      const dto = {
        fullName: 'Test User',
        dob: '2000-01-01',
        idNumber: '123456',
        idFrontImg: 'front.jpg',
        idBackImg: 'back.jpg',
        selfieImg: 'selfie.jpg',
      };

      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.submitKyc('user-id', dto as any);

      expect(result).toEqual({
        message: 'KYC information submitted successfully.',
        status: 'PENDING',
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('getMyKyc', () => {
    it('should return user KYC record', async () => {
      const mockRecord = { id: 'kyc-id', userId: 'user-id' };
      mockPrisma.kycRecord.findUnique.mockResolvedValue(mockRecord);

      const result = await service.getMyKyc('user-id');

      expect(result).toEqual(mockRecord);
    });
  });

  describe('listPendingRequests', () => {
    it('should return pending KYC requests', async () => {
      const mockRequests = [{ id: 'kyc-1' }, { id: 'kyc-2' }];
      mockPrisma.kycRecord.findMany.mockResolvedValue(mockRequests);

      const result = await service.listPendingRequests();

      expect(result).toEqual(mockRequests);
      expect(mockPrisma.kycRecord.findMany).toHaveBeenCalledWith({
        where: { status: { in: ['PENDING', 'APPROVING'] } },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('approveKyc', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.approveKyc('user-id', 'admin-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should move KYC to approving and create multisig proposal', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ walletAddress: '0x123' });
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.approveKyc('user-id', 'admin-id');

      expect(result.status).toEqual('APPROVING');
      expect(result.proposalId).toEqual('proposal-1');
      expect(mockMultiSigService.createProposal).toHaveBeenCalled();
    });
  });

  describe('rejectKyc', () => {
    it('should throw BadRequestException if reason is empty', async () => {
      await expect(
        service.rejectKyc('user-id', '', 'admin-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject KYC and create notification', async () => {
      mockPrisma.$transaction.mockResolvedValue([]);
      mockNotificationsService.createNotification.mockResolvedValue({});

      const result = await service.rejectKyc(
        'user-id',
        'Invalid documents',
        'admin-id',
      );

      expect(result).toEqual({
        message: 'KYC request rejected successfully.',
        status: 'REJECTED',
      });
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith({
        userId: 'user-id',
        type: 'KYC_REJECTED',
        title: 'KYC Rejected',
        content: expect.any(String),
      });
    });
  });
});
