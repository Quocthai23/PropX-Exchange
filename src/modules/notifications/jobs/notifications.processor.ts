import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Processor('notifications', {
  concurrency: 5,
})
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    if (job.name === 'send-notification') {
      await this.handleSendNotification(job.data);
    } else if (job.name === 'broadcast-notification') {
      await this.handleBroadcastNotification(job.data);
    }
  }

  private async handleSendNotification(data: {
    userId: string;
    type: string;
    title: string;
    content?: string;
    metadata?: any;
  }) {
    // Check User Preferences
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
      select: { notificationPreferences: true, id: true },
    });

    if (!user) return;

    const prefs: any = user.notificationPreferences || {};

    // Example: If inApp is allowed (default true)
    if (prefs.inApp !== false) {
      await this.prisma.notification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          content: data.content,
          metadata: data.metadata,
        },
      });
    }

    // Example: If email is allowed
    if (prefs.email === true) {
      this.logger.log(`Queueing email notification for user ${data.userId}`);
      // await this.emailQueue.add('send-email', ...)
    }

    // Example: If push is allowed
    if (prefs.push === true) {
      this.logger.log(
        `Sending push notification via FCM for user ${data.userId}`,
      );
      // Push via firebase-admin
    }
  }

  private async handleBroadcastNotification(data: {
    userIds: string[];
    type: string;
    title: string;
    content?: string;
  }) {
    this.logger.log(
      `Broadcasting notification to ${data.userIds.length} users`,
    );

    const chunkArray = (arr: any[], size: number) =>
      Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size),
      );

    const chunks = chunkArray(data.userIds, 1000);

    for (const chunk of chunks) {
      const dataToInsert = chunk.map((userId) => ({
        userId,
        type: data.type,
        title: data.title,
        content: data.content,
      }));

      await this.prisma.notification.createMany({
        data: dataToInsert,
        skipDuplicates: true,
      });
    }
  }
}
