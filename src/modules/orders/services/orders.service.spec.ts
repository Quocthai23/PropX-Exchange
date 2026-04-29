import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { BalancesService } from '../../balances/services/balances.service';
import { OrderMatchingService } from './order-matching.service';
import Decimal from 'decimal.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  $transaction: jest.fn((fn) => fn(mockTx)),
  order: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  asset: {
    findUnique: jest.fn(),
  },
};

const mockTx = {
  order: {
    update: jest.fn(),
  },
};

const mockBalancesService = {
  updateBalance: jest.fn(),
};

const mockOrderMatchingService = {
  queueOrder: jest.fn(),
};

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BalancesService, useValue: mockBalancesService },
        { provide: OrderMatchingService, useValue: mockOrderMatchingService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should return existing order if idempotency key exists', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'existing-order-id',
        status: 'OPEN',
      });

      const result = await service.createOrder('user-id', {
        side: 'BUY',
        type: 'LIMIT',
        assetId: 'asset-id',
        quantity: '10',
        price: '100',
        idempotencyKey: 'test-key',
      } as any);

      expect(result).toEqual({
        orderId: 'existing-order-id',
        status: 'OPEN',
      });
    });

    it('should throw NotFoundException if asset not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrder('user-id', {
          side: 'BUY',
          type: 'LIMIT',
          assetId: 'asset-id',
          quantity: '10',
          price: '100',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if asset not available for trading', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);
      mockPrisma.asset.findUnique.mockResolvedValue({
        id: 'asset-id',
        isActive: false,
        tradingStatus: 'CLOSED',
      });

      await expect(
        service.createOrder('user-id', {
          side: 'BUY',
          type: 'LIMIT',
          assetId: 'asset-id',
          quantity: '10',
          price: '100',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create BUY order successfully', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);
      mockPrisma.asset.findUnique.mockResolvedValue({
        id: 'asset-id',
        isActive: true,
        tradingStatus: 'OPEN',
        tokenPrice: new Decimal(100),
      });
      mockBalancesService.updateBalance.mockResolvedValue({});
      mockPrisma.order.create.mockResolvedValue({
        id: 'new-order-id',
        status: 'OPEN',
      });
      mockOrderMatchingService.queueOrder.mockResolvedValue({});

      const result = await service.createOrder('user-id', {
        side: 'BUY',
        type: 'LIMIT',
        assetId: 'asset-id',
        quantity: '10',
        price: '100',
      } as any);

      expect(result).toEqual({
        orderId: 'new-order-id',
        status: 'OPEN',
      });
    });
  });

  describe('getOrders', () => {
    it('should return user orders with filters', async () => {
      const mockOrders = [{ id: 'order-1', userId: 'user-id' }];
      mockPrisma.order.findMany.mockResolvedValue(mockOrders);
      mockPrisma.order.count.mockResolvedValue(1);

      const result = await service.getOrders('user-id', {} as any);

      expect(result.data).toEqual(mockOrders);
      expect(result.total).toEqual(1);
    });
  });

  describe('cancelOrder', () => {
    it('should throw NotFoundException if order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.cancelOrder('user-id', 'order-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if not order owner', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-id',
        userId: 'other-user-id',
      });

      await expect(service.cancelOrder('user-id', 'order-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
