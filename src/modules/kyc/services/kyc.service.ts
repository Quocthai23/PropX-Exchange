import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateKycDto } from '../dto/create-kyc.dto';

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('kyc-approval') private kycQueue: Queue,
  ) {}

  async submitKyc(userId: string, dto: CreateKycDto) {
    const payload = {
      fullName: dto.fullName,
      dob: new Date(dto.dob),
      idNumber: dto.idNumber,
      idFrontImg: dto.idFrontImg,
      idBackImg: dto.idBackImg,
      selfieImg: dto.selfieImg,
      status: 'PENDING',
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
        data: { kycStatus: 'PENDING' },
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
        data: { status: 'APPROVING', rejectReason: null },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { kycStatus: 'APPROVING' },
      }),
    ]);

    await this.prisma.auditLog.create({
      data: {
        entity: 'KYC',
        entityId: userId,
        action: 'APPROVED',
        performedBy: adminId,
        details: `Admin ${adminId} approved KYC for user ${userId}. Queued for blockchain verification.`,
      },
    });

    await this.kycQueue.add('approve', {
      targetUserId: userId,
      walletAddress: user.walletAddress,
    });

    return {
      message: 'KYC approval request has been queued for blockchain processing.',
      approvalInProgress: true,
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
          status: 'REJECTED',
          rejectReason: reason.trim(),
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { kycStatus: 'REJECTED' },
      }),
    ]);

    await this.prisma.auditLog.create({
      data: {
        entity: 'KYC',
        entityId: userId,
        action: 'REJECTED',
        performedBy: adminId ?? 'SYSTEM',
        details: reason.trim(),
      },
    });

    return {
      message: 'KYC request rejected successfully.',
      status: 'REJECTED',
    };
  }
}

