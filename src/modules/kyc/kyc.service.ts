import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import type { KycStatus } from '@prisma/client';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainService } from './blockchain.service';

type SubmitKycPayload = {
  fullName: string;
  dob: string;
  idNumber: string;
  idFrontImg: string;
  idBackImg: string;
  selfieImg: string;
};

@Injectable()
export class KycService {
  private readonly encryptionKey: Buffer;
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    @InjectQueue('kyc-approval') private kycApprovalQueue: Queue,
  ) {
    const piiSecret = process.env.KYC_PII_ENCRYPTION_KEY;
    if (!piiSecret) {
      throw new Error('KYC_PII_ENCRYPTION_KEY is required for PII encryption.');
    }
    this.encryptionKey = crypto.createHash('sha256').update(piiSecret).digest();
  }

  private encryptPII(value: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decryptPII(value: string): string {
    const parts = value.split(':');
    if (parts.length !== 3) {
      throw new InternalServerErrorException('Stored PII format is invalid.');
    }

    const [ivHex, tagHex, encryptedHex] = parts;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  private maskIdNumber(value: string): string {
    if (value.length <= 4) {
      return `****${value}`;
    }
    return `${'*'.repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
  }

  private assertPrivateAssetUrl(url: string): void {
    let parsed: URL;

    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Image URL must be a valid URL.');
    }

    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('Image URL must use HTTPS.');
    }

    const hasSignedToken = [
      'X-Amz-Signature',
      'X-Amz-Expires',
      'token',
      'sig',
      'signature',
      'expires',
      'expiry',
    ].some((key) => parsed.searchParams.has(key));

    if (!hasSignedToken) {
      throw new BadRequestException(
        'Image URL must be private (signed URL with access token/expiry).',
      );
    }
  }

  private ensurePendingStatus(status: KycStatus): void {
    if (status !== 'PENDING') {
      throw new BadRequestException('KYC request is not in pending state.');
    }
  }

  async submitKyc(
    userId: string,
    dto: SubmitKycPayload,
  ): Promise<{ message: string }> {
    this.assertPrivateAssetUrl(dto.idFrontImg);
    this.assertPrivateAssetUrl(dto.idBackImg);
    this.assertPrivateAssetUrl(dto.selfieImg);

    const encryptedIdNumber = this.encryptPII(dto.idNumber);

    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, kycStatus: true },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found.');
    }

    if (existingUser.kycStatus === 'PENDING') {
      throw new BadRequestException(
        'Your KYC request is already pending approval.',
      );
    }

    if (existingUser.kycStatus === 'APPROVED') {
      throw new BadRequestException('Your KYC has already been approved.');
    }

    await this.prisma.$transaction([
      this.prisma.kycRecord.upsert({
        where: { userId },
        update: {
          fullName: dto.fullName,
          dob: new Date(dto.dob),
          idNumber: encryptedIdNumber,
          idFrontImg: dto.idFrontImg,
          idBackImg: dto.idBackImg,
          selfieImg: dto.selfieImg,
          status: 'PENDING',
          rejectReason: null,
        },
        create: {
          userId,
          fullName: dto.fullName,
          dob: new Date(dto.dob),
          idNumber: encryptedIdNumber,
          idFrontImg: dto.idFrontImg,
          idBackImg: dto.idBackImg,
          selfieImg: dto.selfieImg,
          status: 'PENDING',
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { kycStatus: 'PENDING' },
      }),
    ]);

    return { message: 'KYC submitted successfully. Please wait for review.' };
  }

  async getMyKyc(userId: string): Promise<{
    userId: string;
    kycStatus: KycStatus;
    record: {
      fullName: string;
      dob: Date;
      idNumber: string;
      idFrontImg: string;
      idBackImg: string;
      selfieImg: string;
      status: KycStatus;
      rejectReason: string | null;
      createdAt: Date;
    } | null;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        kycStatus: true,
        kycRecord: {
          select: {
            fullName: true,
            dob: true,
            idNumber: true,
            idFrontImg: true,
            idBackImg: true,
            selfieImg: true,
            status: true,
            rejectReason: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return {
      userId: user.id,
      kycStatus: user.kycStatus,
      record: user.kycRecord
        ? {
            ...user.kycRecord,
            idNumber: this.maskIdNumber(
              this.decryptPII(user.kycRecord.idNumber),
            ),
          }
        : null,
    };
  }

  async listPendingRequests() {
    const records = await this.prisma.kycRecord.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: {
        userId: true,
        fullName: true,
        dob: true,
        idNumber: true,
        idFrontImg: true,
        idBackImg: true,
        selfieImg: true,
        status: true,
        createdAt: true,
      },
    });

    return records.map((record) => ({
      ...record,
      idNumber: this.decryptPII(record.idNumber),
    }));
  }

  async approveKyc(
    targetUserId: string,
  ): Promise<{ message: string; approvalInProgress: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        walletAddress: true,
        kycRecord: { select: { status: true } },
      },
    });

    if (!user || !user.kycRecord) {
      throw new NotFoundException('KYC record not found.');
    }

    if (!user.walletAddress) {
      throw new BadRequestException('User wallet address is missing.');
    }

    this.ensurePendingStatus(user.kycRecord.status);

    // Update status to APPROVING immediately (synchronous)
    await this.prisma.$transaction([
      this.prisma.kycRecord.update({
        where: { userId: targetUserId },
        data: { status: 'APPROVING', rejectReason: null },
      }),
      this.prisma.user.update({
        where: { id: targetUserId },
        data: { kycStatus: 'APPROVING' },
      }),
    ]);

    // Queue async blockchain approval job
    await this.kycApprovalQueue.add(
      'approve',
      {
        targetUserId,
        walletAddress: user.walletAddress,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log(
      `KYC approval job queued for user ${targetUserId}. Status set to APPROVING.`,
    );

    return {
      message:
        'KYC approval request received. Processing blockchain confirmation in background.',
      approvalInProgress: true,
    };
  }

  async rejectKyc(
    targetUserId: string,
    reason: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, kycRecord: { select: { status: true } } },
    });

    if (!user || !user.kycRecord) {
      throw new NotFoundException('KYC record not found.');
    }

    this.ensurePendingStatus(user.kycRecord.status);

    await this.prisma.$transaction([
      this.prisma.kycRecord.update({
        where: { userId: targetUserId },
        data: { status: 'REJECTED', rejectReason: reason },
      }),
      this.prisma.user.update({
        where: { id: targetUserId },
        data: { kycStatus: 'REJECTED' },
      }),
    ]);

    return { message: 'KYC rejected successfully.' };
  }
}
