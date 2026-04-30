import { Module } from '@nestjs/common';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationsService } from './services/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';

import { BullModule } from '@nestjs/bullmq';
import { NotificationsProcessor } from './jobs/notifications.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, PrismaService, NotificationsProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
