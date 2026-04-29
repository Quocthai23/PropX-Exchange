import { TradingLedgerService } from './trading-ledger.service';
import { $Enums } from '@prisma/client';
import Decimal from 'decimal.js';

const mockBalancesService = {
  transferBetweenAvailableAndLocked: jest.fn(),
  updateBalance: jest.fn(),
};

const mockTx = {
  transaction: {
    createMany: jest.fn(),
  },
};

describe('TradingLedgerService', () => {
  let service: TradingLedgerService;

  beforeEach(() => {
    service = new TradingLedgerService(mockBalancesService as any);
    jest.clearAllMocks();
  });

  it('locks BUY order funds from available to locked cash', async () => {
    await service.lockOrderFunds({
      tx: mockTx as any,
      userId: 'buyer-1',
      side: $Enums.OrderSide.BUY,
      assetId: 'asset-1',
      quantity: new Decimal(2),
      price: new Decimal(100),
    });

    expect(
      mockBalancesService.transferBetweenAvailableAndLocked,
    ).toHaveBeenCalledWith(
      'buyer-1',
      null,
      new Decimal(200),
      'available_to_locked',
      mockTx,
    );
  });

  it('settles matched trade with balanced debit/credit legs', async () => {
    await service.settleMatch({
      tx: mockTx as any,
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      assetId: 'asset-1',
      quantity: new Decimal(3),
      price: new Decimal(50),
    });

    expect(mockBalancesService.updateBalance).toHaveBeenCalledTimes(4);
    expect(mockTx.transaction.createMany).toHaveBeenCalled();
  });
});
