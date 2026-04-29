import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GetNotificationsQueryDto } from '../dto/notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getNotifications(userId: string, query: GetNotificationsQueryDto) {
    await Promise.resolve();
    void userId;
    void query;
    // TODO: Truy vấn danh sách thông báo từ DB
    return { data: [], total: 0 };
  }

  async getUnreadCount(userId: string) {
    await Promise.resolve();
    void userId;
    // TODO: Đếm số lượng thông báo chưa đọc
    return { unreadCount: 0 };
  }

  async markAllAsRead(userId: string) {
    await Promise.resolve();
    void userId;
    return { success: true };
  }

  async markAsRead(userId: string, notificationId: string) {
    await Promise.resolve();
    void userId;
    void notificationId;
    return { success: true };
  }
}
