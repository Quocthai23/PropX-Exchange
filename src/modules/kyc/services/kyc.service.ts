import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { $Enums } from '@prisma/client';
import { CreateKycDto } from '../dto/create-kyc.dto';
import { NotificationsService } from '../../notifications/services/notifications.service';

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('kyc-approval') private kycQueue: Queue,
    private notificationsService: NotificationsService,
  ) {}

  async submitKyc(userId: string, dto: CreateKycDto) {
    const payload = {
      fullName: dto.fullName,
      dob: new Date(dto.dob),
      idNumber: dto.idNumber,
      idFrontImg: dto.idFrontImg,
      idBackImg: dto.idBackImg,
      selfieImg: dto.selfieImg,
      status: $Enums.KycStatus.PENDING,
      rejectReason: null,
    };

    await this.prisma.$transaction([
      this.prisma.kycRecord.upsert({
        where: { userId },
        create: { userId, ...payload },
        update: payload,
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { kycStatus: $Enums.KycStatus.PENDING },
      }),
      this.prisma.auditLog.create({
        data: {
          entity: 'KYC',
          entityId: userId,
          action: 'SUBMITTED',
          performedBy: userId,
          details: 'User submitted KYC information for review.',
        },
      }),
    ]);

    return {
      message: 'KYC information submitted successfully.',
      status: 'PENDING',
    };
  }

  async getMyKyc(userId: string) {
    return this.prisma.kycRecord.findUnique({
      where: { userId },
    });
  }

  async listPendingRequests() {
    return this.prisma.kycRecord.findMany({
      where: {
        status: {
          in: ['PENDING', 'APPROVING'],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveKyc(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    await this.prisma.$transaction([
      this.prisma.kycRecord.update({
        where: { userId },
        data: {
          status: $Enums.KycStatus.APPROVED,
          rejectReason: null,
          approvedBy: adminId,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { kycStatus: $Enums.KycStatus.APPROVED },
      }),
      this.prisma.auditLog.create({
        data: {
          entity: 'KYC',
          entityId: userId,
          action: 'APPROVED',
          performedBy: adminId,
          details: `Admin ${adminId} approved KYC for user ${userId}.`,
        },
      }),
    ]);

    await this.notificationsService.createNotification({
      userId,
      type: 'KYC_APPROVED',
      title: 'KYC Approved!',
      content:
        'Your KYC verification has been approved. You can now use all platform features.',
    });

    return {
      message: 'KYC approved successfully.',
      status: 'APPROVED',
    };
  }

  async rejectKyc(userId: string, reason: string, adminId?: string) {
    if (!reason?.trim()) {
      throw new BadRequestException('Reject reason is required.');
    }

    await this.prisma.$transaction([
      this.prisma.kycRecord.update({
        where: { userId },
        data: {
          status: $Enums.KycStatus.REJECTED,
          rejectReason: reason.trim(),
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { kycStatus: $Enums.KycStatus.REJECTED },
      }),
      this.prisma.auditLog.create({
        data: {
          entity: 'KYC',
          entityId: userId,
          action: 'REJECTED',
          performedBy: adminId ?? 'SYSTEM',
          details: reason.trim(),
        },
      }),
    ]);

    await this.notificationsService.createNotification({
      userId,
      type: 'KYC_REJECTED',
      title: 'KYC Rejected',
      content: `Your KYC verification has been rejected. Reason: ${reason.trim()}. Please resubmit with correct information.`,
    });

    return {
      message: 'KYC request rejected successfully.',
      status: 'REJECTED',
    };
  }
}
