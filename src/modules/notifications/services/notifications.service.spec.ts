import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  notification: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
  },
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  describe('createNotification', () => {
    it('should create notification successfully', async () => {
      mockPrisma.notification.create.mockResolvedValue({
        id: 'notif-id',
        userId: 'user-id',
        type: 'TEST',
        title: 'Test Notification',
      });

      const result = await service.createNotification({
        userId: 'user-id',
        type: 'TEST',
        title: 'Test Notification',
      });

      expect(result.id).toEqual('notif-id');
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockPrisma.notification.count.mockResolvedValue(5);

      const result = await service.getUnreadCount('user-id');

      expect(result.unreadCount).toEqual(5);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all as read', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({});

      const result = await service.markAllAsRead('user-id');

      expect(result.success).toEqual(true);
    });
  });
});
