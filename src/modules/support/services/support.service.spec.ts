import { Test, TestingModule } from '@nestjs/testing';
import { SupportService } from './support.service';
import { PrismaService } from '@/prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

const mockPrisma = {
  $transaction: jest.fn((fn) => fn(mockTx)),
  supportTicket: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  ticketMessage: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const mockTx = {
  supportTicket: {
    create: jest.fn(),
  },
  ticketMessage: {
    create: jest.fn(),
  },
};

describe('SupportService', () => {
  let service: SupportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SupportService>(SupportService);
    jest.clearAllMocks();
  });

  describe('createTicket', () => {
    it('should create ticket and initial message', async () => {
      mockTx.supportTicket.create.mockResolvedValue({ id: 'ticket-id' });
      mockTx.ticketMessage.create.mockResolvedValue({});

      const result = await service.createTicket('user-id', {
        title: 'Test Ticket',
        category: 'GENERAL',
        initialMessage: 'Help!',
      } as any);

      expect(result.id).toEqual('ticket-id');
    });
  });

  describe('getTicketDetail', () => {
    it('should throw NotFoundException if ticket not found', async () => {
      mockPrisma.supportTicket.findUnique.mockResolvedValue(null);

      await expect(
        service.getTicketDetail('user-id', 'ticket-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not ticket owner', async () => {
      mockPrisma.supportTicket.findUnique.mockResolvedValue({
        id: 'ticket-id',
        userId: 'other-user-id',
      });

      await expect(
        service.getTicketDetail('user-id', 'ticket-id'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
