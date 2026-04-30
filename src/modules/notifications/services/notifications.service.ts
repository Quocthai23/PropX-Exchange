import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { GetNotificationsQueryDto } from '../dto/notifications.dto';

import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  async createNotification(data: {
    userId: string;
    type: string;
    title: string;
    content?: string;
    metadata?: any;
  }) {
    await this.notificationsQueue.add('send-notification', data);
    return { queued: true };
  }

  async broadcastNotification(data: {
    userIds: string[];
    type: string;
    title: string;
    content?: string;
  }) {
    await this.notificationsQueue.add('broadcast-notification', data);
    return { queued: true };
  }

  async getNotifications(userId: string, query: GetNotificationsQueryDto) {
    const where: any = { userId };
    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip || 0,
        take: query.take || 20,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, total };
  }

  async getUnreadCount(userId: string) {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount };
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }

  async markAsRead(userId: string, notificationId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
    return { success: true };
  }
}
