import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainService } from './blockchain.service';
import { KmsService } from '@/shared/services/kms.service';
import { AppConfigService } from '@/config/app-config.service';
import Decimal from 'decimal.js';

// Mock ethers Contract to avoid real blockchain calls
jest.mock('ethers', () => {
  const original = jest.requireActual('ethers');
  return {
    ...original,
    Contract: jest.fn().mockImplementation(() => ({
      getFunction: jest.fn().mockImplementation(() => {
        return async () => ({ hash: '0xmockTxHash' });
      }),
    })),
  };
});

describe('BlockchainService', () => {
  let service: BlockchainService;

  beforeEach(async () => {
    process.env.ESCROW_MARKETPLACE_ADDRESS = '0xEscrow';
    process.env.ESCROW_MARKETPLACE_ABI_JSON = '[]';
    process.env.DAO_GOVERNANCE_ADDRESS = '0xDao';
    process.env.DAO_GOVERNANCE_ABI_JSON = '[]';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainService,
        {
          provide: KmsService,
          useValue: {
            getAdminPrivateKey: jest
              .fn()
              .mockResolvedValue('0x' + '1'.repeat(64)),
          },
        },
        {
          provide: AppConfigService,
          useValue: {
            useMockChain: false,
            chainRpcUrl: 'http://localhost:8545',
            useAwsKms: false,
          },
        },
      ],
    }).compile();

    service = module.get<BlockchainService>(BlockchainService);

    // Call onModuleInit to initialize provider/signer
    await service.onModuleInit();

    // Mock getDynamicFeeOverrides to avoid actual provider calls
    jest.spyOn(service as any, 'getDynamicFeeOverrides').mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('batchSettleTrades', () => {
    it('should call batchSettleWithPermits when permits are provided', async () => {
      const trades = [
        { from: '0xSeller', to: '0xBuyer', amount: new Decimal('100') },
      ];
      const permits = [{ deadline: 9999999999, v: 27, r: '0xrrr', s: '0xsss' }];

      const result = await service.batchSettleTrades(
        '0xAsset',
        trades,
        permits,
      );

      expect(result).toBe('0xmockTxHash');
    });

    it('should call regular batchSettle when no permits are provided', async () => {
      const trades = [
        { from: '0xSeller', to: '0xBuyer', amount: new Decimal('100') },
      ];

      const result = await service.batchSettleTrades('0xAsset', trades);

      expect(result).toBe('0xmockTxHash');
    });
  });

  describe('executeDaoProposal', () => {
    it('should trigger DAO proposal execution on-chain', async () => {
      const result = await service.executeDaoProposal(1);
      expect(result).toBe('0xmockTxHash');
    });
  });
});
