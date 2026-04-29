import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import Decimal from 'decimal.js';
import { OrderMatchingService } from './order-matching.service';
import { PrismaService } from '@/prisma/prisma.service';
import { TradingLedgerService } from './trading-ledger.service';
import { MarketDataService } from '@/modules/market-data/services/market-data.service';

const mockQueue = {
  add: jest.fn(),
  count: jest.fn(),
};

const mockTx = {
  order: { update: jest.fn() },
  trade: { create: jest.fn() },
  asset: { update: jest.fn() },
};

const mockPrisma = {
  order: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(async (fn: any) => fn(mockTx)),
};

const mockTradingLedgerService = {
  settleMatch: jest.fn(),
  refundBuyerPriceImprovement: jest.fn(),
};

const mockMarketDataService = {
  recordTrade: jest.fn(),
};

describe('OrderMatchingService', () => {
  let service: OrderMatchingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderMatchingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TradingLedgerService, useValue: mockTradingLedgerService },
        { provide: MarketDataService, useValue: mockMarketDataService },
        { provide: getQueueToken('order-matching'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<OrderMatchingService>(OrderMatchingService);
    jest.clearAllMocks();
    mockTradingLedgerService.settleMatch.mockResolvedValue(undefined);
    mockTradingLedgerService.refundBuyerPriceImprovement.mockResolvedValue(
      undefined,
    );
    mockMarketDataService.recordTrade.mockResolvedValue(undefined);
  });

  it('queues order with deterministic job id for idempotency', async () => {
    mockQueue.add.mockResolvedValue({ id: 'order-1' });

    await service.queueOrder('order-1');

    expect(mockQueue.add).toHaveBeenCalledWith(
      'match',
      { orderId: 'order-1' },
      expect.objectContaining({ jobId: 'order-1' }),
    );
  });

  it('matches one order against multiple counterparties with partial fill', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'incoming',
      userId: 'buyer-1',
      assetId: 'asset-1',
      side: 'BUY',
      status: 'OPEN',
      price: new Decimal(100),
      quantity: new Decimal(10),
      filledQuantity: new Decimal(0),
    });
    mockPrisma.order.findMany.mockResolvedValue([
      {
        id: 'sell-1',
        userId: 'seller-1',
        price: new Decimal(100),
        quantity: new Decimal(6),
        filledQuantity: new Decimal(0),
      },
      {
        id: 'sell-2',
        userId: 'seller-2',
        price: new Decimal(100),
        quantity: new Decimal(10),
        filledQuantity: new Decimal(0),
      },
    ]);

    const result = await service.matchOrder({ orderId: 'incoming' });

    expect(result).toEqual({ matched: 2 });
    expect(mockTradingLedgerService.settleMatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ quantity: new Decimal(6) }),
    );
    expect(mockTradingLedgerService.settleMatch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ quantity: new Decimal(4) }),
    );
  });

  it('rolls back trade updates when ledger settlement fails', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'incoming',
      userId: 'buyer-1',
      assetId: 'asset-1',
      side: 'BUY',
      status: 'OPEN',
      price: new Decimal(100),
      quantity: new Decimal(2),
      filledQuantity: new Decimal(0),
    });
    mockPrisma.order.findMany.mockResolvedValue([
      {
        id: 'sell-1',
        userId: 'seller-1',
        price: new Decimal(100),
        quantity: new Decimal(2),
        filledQuantity: new Decimal(0),
      },
    ]);
    mockTradingLedgerService.settleMatch.mockRejectedValueOnce(
      new Error('ledger failure'),
    );

    await expect(service.matchOrder({ orderId: 'incoming' })).rejects.toThrow(
      'ledger failure',
    );
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});
