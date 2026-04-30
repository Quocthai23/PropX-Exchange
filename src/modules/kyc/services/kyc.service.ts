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
import * as crypto from 'crypto';

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
    findUnique(
      args: Record<string, unknown>,
    ): Promise<{ walletAddress: string | null } | null>;
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
  private readonly encryptionKey = Buffer.from(
    process.env.WALLET_ENCRYPTION_KEY || '12345678901234567890123456789012',
    'utf-8',
  );

  constructor(
    prismaService: PrismaService,
    @InjectQueue('kyc-approval') private kycQueue: Queue,
    private notificationsService: NotificationsService,
    private readonly blockchainService: BlockchainService,
    private readonly multiSigService: MultiSigService,
  ) {
    this.prisma = prismaService as unknown as KycPrisma;
  }

  private encryptIdNumber(text: string): string {
    const iv = Buffer.alloc(16, 0); // Deterministic IV for @unique
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  private decryptIdNumber(text: string): string {
    if (!text || !/^[0-9a-fA-F]+$/.test(text)) return text;
    try {
      const iv = Buffer.alloc(16, 0);
      const encryptedText = Buffer.from(text, 'hex');
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        this.encryptionKey,
        iv,
      );
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString('utf8');
    } catch {
      return text;
    }
  }

  async submitKyc(userId: string, dto: CreateKycDto) {
    const payload = {
      fullName: dto.fullName,
      dob: new Date(dto.dob),
      idNumber: this.encryptIdNumber(dto.idNumber),
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
    const record: any = await this.prisma.kycRecord.findUnique({
      where: { userId },
    });
    if (record && record.idNumber) {
      record.idNumber = this.decryptIdNumber(record.idNumber as string);
    }
    return record;
  }

  async listPendingRequests() {
    const records: any[] = (await this.prisma.kycRecord.findMany({
      where: {
        status: {
          in: ['PENDING', 'APPROVING'],
        },
      },
      orderBy: { createdAt: 'desc' },
    })) as any[];

    return records.map((record) => {
      if (record.idNumber) {
        record.idNumber = this.decryptIdNumber(record.idNumber);
      }
      return record;
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
    if (!user.walletAddress) {
      throw new BadRequestException(
        'User has not linked a wallet address yet. Cannot whitelist.',
      );
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

    const approval = await this.multiSigService.approve(
      proposal.proposalId,
      adminId,
    );
    if (approval.status === 'EXECUTED') {
      await this.kycQueue.add('process-whitelist', {
        userId,
        walletAddress: user.walletAddress,
        adminId,
      });
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
    await this.kycQueue.add('process-whitelist', {
      userId,
      walletAddress,
      adminId,
    });

    return {
      proposalId,
      status: 'APPROVED',
      approvals: approval.approvals.length,
      requiredApprovals: approval.requiredApprovals,
    };
  }

  // Bỏ hàm executeKycWhitelist vì đã chuyển logic sang kyc-approval.processor.ts

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
