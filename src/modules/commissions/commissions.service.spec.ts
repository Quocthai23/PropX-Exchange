import { Test, TestingModule } from '@nestjs/testing';
import { CommissionsService } from './commissions.service';
import { PrismaService } from '@/prisma/prisma.service';
import { KmsService } from '@/shared/services/kms.service';
import { getQueueToken } from '@nestjs/bullmq';
import { ethers } from 'ethers';

describe('CommissionsService', () => {
  let service: CommissionsService;

  const mockPrismaService = {
    commissionReward: {
      findMany: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
    },
    balance: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockKmsService = {
    getAdminPrivateKey: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: KmsService, useValue: mockKmsService },
        { provide: getQueueToken('commissions'), useValue: {} },
      ],
    }).compile();

    service = module.get<CommissionsService>(CommissionsService);
  });

  describe('generateClaimSignature', () => {
    it('should use kmsService to sign the claim payload securely', async () => {
      const randomWallet = ethers.Wallet.createRandom();
      mockKmsService.getAdminPrivateKey.mockResolvedValue(
        randomWallet.privateKey,
      );

      const rewards = [
        {
          id: '1',
          amount: { toNumber: () => 50 },
          currency: 'USDT',
          status: 'AVAILABLE',
        },
        {
          id: '2',
          amount: { toNumber: () => 50 },
          currency: 'USDT',
          status: 'AVAILABLE',
        },
      ];

      mockPrismaService.commissionReward.findMany.mockResolvedValue(rewards);

      const result = await service.generateClaimSignature('user-1', {
        rewardIds: ['1', '2'],
      });

      expect(mockKmsService.getAdminPrivateKey).toHaveBeenCalled();
      expect(result.signerAddress).toBe(randomWallet.address);
      expect(result.totalAmount).toBe(100);
      expect(result.signature).toBeDefined();

      const expectedAmountWei = ethers.parseUnits('100', 18);
      const messageHash = ethers.solidityPackedKeccak256(
        ['string', 'string', 'uint256', 'uint256'],
        ['user-1', 'USDT', expectedAmountWei, result.nonce],
      );

      const recovered = ethers.recoverAddress(
        ethers.hashMessage(ethers.getBytes(messageHash)),
        result.signature,
      );
      expect(recovered).toBe(randomWallet.address);
    });
  });
});
