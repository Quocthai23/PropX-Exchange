import {
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { PrismaService } from '../../../prisma/prisma.service';
import { BlockchainService } from '../blockchain.service';

interface KycApprovalJobData {
  targetUserId: string;
  walletAddress: string;
}

@Processor('kyc-approval')
export class KycApprovalProcessor {
  private readonly logger = new Logger(KycApprovalProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
  ) {}

  @Process('approve')
  async handleKycApproval(job: Job<KycApprovalJobData>) {
    const { targetUserId, walletAddress } = job.data;

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
          data: { status: 'APPROVED', rejectReason: null },
        }),
        this.prisma.user.update({
          where: { id: targetUserId },
          data: { kycStatus: 'APPROVED' },
        }),
      ]);

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
