import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateKycDto } from '../dto/create-kyc.dto';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { BlockchainService } from './blockchain.service';
import { MultiSigService } from '@/shared/services/multisig.service';

type KycStatus = 'PENDING' | 'APPROVING' | 'APPROVED' | 'REJECTED';

interface KycPrisma {
  $transaction<T>(queries: Promise<unknown>[]): Promise<T>;
  kycRecord: {
    upsert(args: Record<string, unknown>): Promise<unknown>;
    findUnique(args: Record<string, unknown>): Promise<unknown>;
    findMany(args: Record<string, unknown>): Promise<unknown>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  user: {
    findUnique(args: Record<string, unknown>): Promise<{ walletAddress: string } | null>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  auditLog: {
    create(args: Record<string, unknown>): Promise<unknown>;
  };
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);
  private readonly prisma: KycPrisma;

  constructor(
    prismaService: PrismaService,
    @InjectQueue('kyc-approval') private kycQueue: Queue,
    private notificationsService: NotificationsService,
    private readonly blockchainService: BlockchainService,
    private readonly multiSigService: MultiSigService,
  ) {
    this.prisma = prismaService as unknown as KycPrisma;
  }

  async submitKyc(userId: string, dto: CreateKycDto) {
    const payload = {
      fullName: dto.fullName,
      dob: new Date(dto.dob),
      idNumber: dto.idNumber,
      idFrontImg: dto.idFrontImg,
      idBackImg: dto.idBackImg,
      selfieImg: dto.selfieImg,
      status: 'PENDING' as KycStatus,
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
        data: { kycStatus: 'PENDING' as KycStatus },
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
          status: 'APPROVING' as KycStatus,
          rejectReason: null,
          approvedBy: adminId,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { kycStatus: 'APPROVING' as KycStatus },
      }),
      this.prisma.auditLog.create({
        data: {
          entity: 'KYC',
          entityId: userId,
          action: 'APPROVAL_INITIATED',
          performedBy: adminId,
          details: `Admin ${adminId} initiated KYC approval for user ${userId}.`,
        },
      }),
    ]);

    const proposal = await this.multiSigService.createProposal(adminId, {
      type: 'KYC_WHITELIST_WALLET',
      payload: {
        userId,
        walletAddress: user.walletAddress,
      },
    });

    const approval = await this.multiSigService.approve(proposal.proposalId, adminId);
    if (approval.status === 'EXECUTED') {
      await this.executeKycWhitelist(userId, user.walletAddress, adminId);
    }

    return {
      message:
        approval.status === 'EXECUTED'
          ? 'KYC approved and wallet whitelisted on-chain.'
          : 'KYC is in APPROVING status. Waiting for multisig approvals.',
      status: approval.status === 'EXECUTED' ? 'APPROVED' : 'APPROVING',
      proposalId: proposal.proposalId,
      approvals: approval.approvals.length,
      requiredApprovals: approval.requiredApprovals,
    };
  }

  async approveKycWhitelistProposal(proposalId: string, adminId: string) {
    const approval = await this.multiSigService.approve(proposalId, adminId);
    if (approval.status !== 'EXECUTED') {
      return {
        proposalId,
        status: approval.status,
        approvals: approval.approvals.length,
        requiredApprovals: approval.requiredApprovals,
      };
    }

    const userId = String(approval.payload.userId ?? '');
    const walletAddress = String(approval.payload.walletAddress ?? '');
    await this.executeKycWhitelist(userId, walletAddress, adminId);

    return {
      proposalId,
      status: 'APPROVED',
      approvals: approval.approvals.length,
      requiredApprovals: approval.requiredApprovals,
    };
  }

  private async executeKycWhitelist(
    userId: string,
    walletAddress: string,
    adminId: string,
  ) {
    await this.blockchainService.addToWhitelist(walletAddress);
    await this.prisma.$transaction([
      this.prisma.kycRecord.update({
        where: { userId },
        data: { status: 'APPROVED' as KycStatus, rejectReason: null },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { kycStatus: 'APPROVED' as KycStatus },
      }),
      this.prisma.auditLog.create({
        data: {
          entity: 'KYC',
          entityId: userId,
          action: 'APPROVED',
          performedBy: adminId,
          details: 'Wallet has been whitelisted on-chain via multisig approval.',
        },
      }),
    ]);

    await this.notificationsService.createNotification({
      userId,
      type: 'KYC_APPROVED',
      title: 'KYC Approved!',
      content:
        'Your wallet is now whitelisted on-chain and your KYC has been approved.',
    });
  }

  async rejectKyc(userId: string, reason: string, adminId?: string) {
    if (!reason?.trim()) {
      throw new BadRequestException('Reject reason is required.');
    }

    await this.prisma.$transaction([
      this.prisma.kycRecord.update({
        where: { userId },
        data: {
          status: 'REJECTED' as KycStatus,
          rejectReason: reason.trim(),
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { kycStatus: 'REJECTED' as KycStatus },
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
