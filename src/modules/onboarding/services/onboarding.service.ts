import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { parseUnits } from 'ethers';
import { PrismaService } from '@/prisma/prisma.service';
import { IpfsService } from '@/modules/assets/services/ipfs.service';
import { BlockchainService } from '@/modules/assets/services/blockchain.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateAssetOnboardingRequestDto } from '../dto/create-asset-onboarding-request.dto';
import { AdminUpdateOnboardingStatusDto } from '../dto/admin-update-onboarding-status.dto';
import { TokenizeOnboardingDto } from '../dto/tokenize-onboarding.dto';
import { $Enums } from '@prisma/client';

const DEFAULT_ASSET_TOKEN_DECIMALS = 18;

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ipfsService: IpfsService,
    private readonly blockchainService: BlockchainService,
    @InjectQueue('asset-blockchain')
    private readonly assetBlockchainQueue: Queue,
  ) {}

  async createRequest(userId: string, dto: CreateAssetOnboardingRequestDto) {
    const created = await this.prisma.assetOnboardingRequest.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        location: dto.location ?? null,
        estimatedValue: new Decimal(dto.estimatedValue),
        legalDocuments: dto.legalDocuments,
        status: $Enums.OnboardingStatus.PENDING,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        entity: 'ASSET_ONBOARDING_REQUEST',
        entityId: created.id,
        action: 'CREATED',
        performedBy: userId,
        details: JSON.stringify({ title: dto.title }),
      },
    });

    return { success: true, data: created };
  }

  async listAdminRequests() {
    const data = await this.prisma.assetOnboardingRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, walletAddress: true } },
      },
    });
    return { data, total: data.length };
  }

  async updateStatus(
    onboardingId: string,
    adminId: string,
    dto: AdminUpdateOnboardingStatusDto,
  ) {
    const existing = await this.prisma.assetOnboardingRequest.findUnique({
      where: { id: onboardingId },
    });
    if (!existing) throw new NotFoundException('onboarding-request-not-found');

    if (existing.status === $Enums.OnboardingStatus.TOKENIZED) {
      throw new BadRequestException('onboarding-request-already-tokenized');
    }

    const updated = await this.prisma.assetOnboardingRequest.update({
      where: { id: onboardingId },
      data: {
        status: dto.status,
        adminNotes: dto.adminNotes ?? existing.adminNotes,
        appraisedValue:
          dto.appraisedValue !== undefined
            ? new Decimal(dto.appraisedValue)
            : existing.appraisedValue,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        entity: 'ASSET_ONBOARDING_REQUEST',
        entityId: onboardingId,
        action: `STATUS_${dto.status}`,
        performedBy: adminId,
        details: JSON.stringify({
          status: dto.status,
          appraisedValue: dto.appraisedValue ?? null,
        }),
      },
    });

    return { success: true, data: updated };
  }

  async tokenize(
    onboardingId: string,
    adminId: string,
    dto: TokenizeOnboardingDto,
  ) {
    const req = await this.prisma.assetOnboardingRequest.findUnique({
      where: { id: onboardingId },
      include: { user: { select: { id: true, walletAddress: true } } },
    });
    if (!req) throw new NotFoundException('onboarding-request-not-found');

    if (req.status !== $Enums.OnboardingStatus.APPROVED) {
      throw new BadRequestException(
        `invalid-status: expected APPROVED, got ${req.status}`,
      );
    }

    // Pin a tamper-resistant legal dossier pointer to IPFS (CID stored on Asset)
    const pinned = await this.ipfsService.pinJson({
      onboardingRequestId: req.id,
      userId: req.userId,
      title: req.title,
      description: req.description,
      location: req.location,
      estimatedValue: req.estimatedValue,
      legalDocuments: req.legalDocuments,
      appraisedValue: req.appraisedValue,
      adminNotes: req.adminNotes,
      tokenization: {
        symbol: dto.symbol,
        tokenStandard: dto.tokenStandard ?? null,
        spvName: dto.spvName ?? null,
      },
      createdAt: req.createdAt,
      pinnedAt: new Date(),
    });

    // Tokenize on-chain (contract creation)
    const tokenizeHash = await this.blockchainService.sendTokenizeTx({
      name: req.title,
      symbol: dto.symbol,
      totalSupply: parseUnits(
        new Decimal(dto.totalSupply).toString(),
        DEFAULT_ASSET_TOKEN_DECIMALS,
      ),
    });

    const totalSupplyDec = new Decimal(dto.totalSupply);
    const tokenPriceDec = new Decimal(dto.tokenPrice);

    const result = await this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
          symbol: dto.symbol,
          name: req.title,
          description: req.description,
          categoryId: dto.categoryId,
          totalSupply: totalSupplyDec,
          tokenPrice: tokenPriceDec,
          isActive: false,
          tradingStatus: $Enums.AssetTradingStatus.PAUSED,
          txHash: tokenizeHash,
          contractAddress: null,
          tokenStandard: dto.tokenStandard ?? null,
          spvName: dto.spvName ?? null,
          legalDocsIpfs: pinned.cid,
          auditReportUrl: dto.auditReportUrl ?? null,
        } as any,
      });

      await tx.transaction.create({
        data: {
          userId: req.userId,
          type: $Enums.TransactionType.MINT,
          amount: totalSupplyDec,
          fee: new Decimal(0),
          status: $Enums.TransactionStatus.PENDING,
          txHash: tokenizeHash,
          confirmations: 0,
        } as any,
      });

      const updatedReq = await tx.assetOnboardingRequest.update({
        where: { id: req.id },
        data: {
          status: $Enums.OnboardingStatus.PROCESSING,
          updatedAt: new Date(),
        },
      });

      return { asset, updatedReq };
    });

    await this.assetBlockchainQueue.add('finalize-mint', {
      assetId: result.asset.id,
      txHash: tokenizeHash,
      onboardingRequestId: req.id,
      adminId,
    });

    return {
      success: true,
      assetId: result.asset.id,
      txHash: tokenizeHash,
      status: 'PROCESSING',
      legalDocsIpfs: pinned.cid,
    };
  }
}
