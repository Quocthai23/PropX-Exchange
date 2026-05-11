import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AuthCleanupCron {
  private readonly logger = new Logger(AuthCleanupCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    try {
      // Bỏ luồng xoá user chưa hoàn tất theo yêu cầu để tránh lỗi Foreign Key Constraint
      /*
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // Clean up incomplete users without password (e.g. they registered an email but didn't set password)
      const incompleteUsers = await this.prisma.user.findMany({
        where: {
          passwordHash: null,
          createdAt: {
            lt: fiveMinutesAgo,
          },
        },
        select: { id: true },
      });

      if (incompleteUsers.length > 0) {
        const userIds = incompleteUsers.map((u) => u.id);

        // Clean up any AuditLogs where these users are the performer to prevent FK constraint error
        await this.prisma.auditLog.deleteMany({
          where: {
            performedBy: {
              in: userIds,
            },
          },
        });

        // Now we can safely delete the users
        const deletedUsers = await this.prisma.user.deleteMany({
          where: {
            id: {
              in: userIds,
            },
          },
        });

        this.logger.log(`Deleted ${deletedUsers.count} incomplete user accounts without a password.`);
      }
      */

      // Clean up expired OTPs just to keep the DB clean
      const deletedOtps = await this.prisma.otp.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      if (deletedOtps.count > 0) {
        this.logger.log(`Deleted ${deletedOtps.count} expired OTPs.`);
      }
    } catch (error) {
      this.logger.error('Error during auth cleanup cron job', error);
    }
  }
}
