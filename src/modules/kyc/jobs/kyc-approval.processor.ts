import {
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '@/prisma/prisma.service';
import { BlockchainService } from '../services/blockchain.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

interface KycApprovalJobData {
  targetUserId?: string;
  userId?: string;
  walletAddress: string;
  adminId?: string;
}

@Processor('kyc-approval')
export class KycApprovalProcessor extends WorkerHost {
  private readonly logger = new Logger(KycApprovalProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<KycApprovalJobData>) {
    if (job.name !== 'approve' && job.name !== 'process-whitelist') {
      return;
    }
    const targetUserId = job.data.targetUserId || job.data.userId;
    if (!targetUserId) throw new Error('User ID is required');
    const { walletAddress, adminId } = job.data;

    try {
      this.logger.log(
        `[KYC Approval Job ${job.id}] Starting blockchain approval for user ${targetUserId}`,
      );

      // Step 1: Call blockchain to add to whitelist
      let txHash: string;
      try {
        const result =
          await this.blockchainService.addToWhitelist(walletAddress);
        txHash = result.txHash;
        this.logger.log(
          `[KYC Approval Job ${job.id}] Blockchain approval successful - txHash: ${txHash}`,
        );
      } catch (blockchainError) {
        const errorMessage =
          blockchainError instanceof Error
            ? blockchainError.message
            : 'Unknown error';
        this.logger.error(
          `[KYC Approval Job ${job.id}] Blockchain approval failed: ${errorMessage}`,
          blockchainError,
        );

        // Update KYC to REJECTED if blockchain fails
        await this.prisma.$transaction([
          this.prisma.kycRecord.update({
            where: { userId: targetUserId },
            data: {
              status: 'REJECTED',
              rejectReason:
                'Blockchain approval failed. Please contact support.',
            },
          }),
          this.prisma.user.update({
            where: { id: targetUserId },
            data: { kycStatus: 'REJECTED' },
          }),
        ]);

        throw new InternalServerErrorException(
          `KYC blockchain approval failed: ${errorMessage}`,
        );
      }

      // Step 2: Update KYC to APPROVED in DB
      const kycRecord = await this.prisma.kycRecord.findUnique({
        where: { userId: targetUserId },
        select: { status: true },
      });

      if (!kycRecord) {
        throw new NotFoundException('KYC record not found');
      }

      if (kycRecord.status !== 'APPROVING') {
        this.logger.warn(
          `[KYC Approval Job ${job.id}] KYC status is ${kycRecord.status}, expected APPROVING. Skipping finalization.`,
        );
        return {
          success: false,
          reason: 'KYC status changed during processing',
        };
      }

      await this.prisma.$transaction([
        this.prisma.kycRecord.update({
          where: { userId: targetUserId },
          data: {
            status: 'APPROVED',
            rejectReason: null,
            onChainWhitelisted: true,
            whitelistTxHash: txHash,
          },
        }),
        this.prisma.user.update({
          where: { id: targetUserId },
          data: { kycStatus: 'APPROVED' },
        }),
        this.prisma.auditLog.create({
          data: {
            entity: 'KYC',
            entityId: targetUserId,
            action: 'APPROVED',
            performedBy: adminId || 'SYSTEM',
            details:
              'Wallet has been whitelisted on-chain via multisig approval.',
          },
        }),
      ]);

      await this.notificationsService.createNotification({
        userId: targetUserId,
        type: 'KYC_APPROVED',
        title: 'KYC Approved!',
        content:
          'Your wallet is now whitelisted on-chain and your KYC has been approved.',
      });

      this.logger.log(
        `[KYC Approval Job ${job.id}] KYC finalized to APPROVED status`,
      );

      return { success: true, txHash };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `[KYC Approval Job ${job.id}] Unhandled error: ${errorMessage}`,
        error,
      );
      throw error;
    }
  }
}
