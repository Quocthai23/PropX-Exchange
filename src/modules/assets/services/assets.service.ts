import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateAssetDto } from '../dto/create-asset.dto';
import { UpdateAssetDto } from '../dto/asset.dto';
import Decimal from 'decimal.js';
import { parseUnits } from 'ethers';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BlockchainService } from './blockchain.service';
import { MultiSigService } from '@/shared/services/multisig.service';
import {
  ReviewAssetOnboardingDto,
  SubmitAssetOnboardingDto,
} from '../dto/asset-onboarding.dto';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    private readonly multiSigService: MultiSigService,
    @InjectQueue('asset-blockchain') private readonly assetQueue: Queue,
  ) {}

  async getAssetCategories() {
    const categories = await this.prisma.assetCategory.findMany({
      where: { isActive: true },
    });
    return categories.map((cat) => ({
      id: cat.id,
      code: cat.name.toUpperCase().replace(/\s+/g, '_'),
      name: cat.name,
      description: cat.description,
      marginMultiplier: '1.0',
    }));
  }

  async getPublicAssets(userId?: string) {
    const assets = await this.prisma.asset.findMany({
      where: { isActive: true },
      include: { category: true },
    });

    let favoriteAssetIds = new Set<string>();
    if (userId) {
      const favorites = await this.prisma.favoriteAsset.findMany({
        where: { userId },
        select: { assetId: true },
      });
      favoriteAssetIds = new Set(favorites.map((f) => f.assetId));
    }

    return assets.map((asset) => ({
      ...asset,
      isFavorite: favoriteAssetIds.has(asset.id),
      isHot: asset.isHot ?? false,
    }));
  }

  async getAdminAssets() {
    return await this.prisma.asset.findMany({
      include: { category: true },
    });
  }

  async createAsset(dto: CreateAssetDto) {
    const asset = await this.prisma.asset.create({
      data: {
        ...dto,
        isActive: false,
        tradingStatus: 'OPEN',
      } as any,
    });
    return { success: true, data: asset };
  }

  async submitOnboarding(
    ownerId: string,
    assetId: string,
    dto: SubmitAssetOnboardingDto,
  ) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('asset-not-found');

    await this.prisma.auditLog.create({
      data: {
        entity: 'ASSET',
        entityId: assetId,
        action: 'ONBOARDING_SUBMITTED',
        performedBy: ownerId,
        details: JSON.stringify(dto),
      },
    });

    return { success: true, status: 'UNDER_DUE_DILIGENCE' };
  }

  async reviewOnboarding(assetId: string, adminId: string, dto: ReviewAssetOnboardingDto) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('asset-not-found');

    await this.prisma.$transaction([
      this.prisma.auditLog.create({
        data: {
          entity: 'ASSET',
          entityId: assetId,
          action: dto.approved ? 'DUE_DILIGENCE_APPROVED' : 'DUE_DILIGENCE_REJECTED',
          performedBy: adminId,
          details: JSON.stringify(dto),
        },
      }),
      this.prisma.asset.update({
        where: { id: assetId },
        data: {
          isActive: false,
          tradingStatus: dto.approved ? 'PAUSED' : asset.tradingStatus,
        },
      }),
    ]);

    return {
      success: true,
      status: dto.approved ? 'PENDING_TOKEN_MINT' : 'REJECTED',
    };
  }

  async approveAsset(id: string, adminId: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('asset-not-found');

    const proposal = await this.multiSigService.createProposal(adminId, {
      type: 'MINT_ASSET_TOKEN',
      payload: {
        assetId: id,
        name: asset.name,
        symbol: asset.symbol,
        totalSupply: asset.totalSupply.toString(),
      },
    });

    const approval = await this.multiSigService.approve(proposal.proposalId, adminId);
    if (approval.status !== 'EXECUTED') {
      return {
        success: true,
        status: 'PENDING_MULTISIG',
        proposalId: proposal.proposalId,
        approvals: approval.approvals.length,
        requiredApprovals: approval.requiredApprovals,
      };
    }

    const tokenizeHash = await this.blockchainService.sendTokenizeTx({
      name: asset.name,
      symbol: asset.symbol,
      totalSupply: parseUnits(asset.totalSupply.toString(), 18),
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.asset.update({
        where: { id },
        data: { txHash: tokenizeHash, isActive: false, tradingStatus: 'PAUSED' },
      });
      await tx.transaction.create({
        data: {
          userId: adminId,
          type: 'MINT',
          amount: asset.totalSupply,
          fee: '0',
          status: 'PENDING',
          txHash: tokenizeHash,
        } as any,
      });
    });
    await this.assetQueue.add(
      'finalize-mint',
      { assetId: id, txHash: tokenizeHash },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return {
      success: true,
      message: 'Da gui lenh mint len blockchain, trang thai: PENDING.',
      proposalId: proposal.proposalId,
      txHash: tokenizeHash,
      status: 'PENDING',
    };
  }

  async approveMintProposal(proposalId: string, adminId: string) {
    const approval = await this.multiSigService.approve(proposalId, adminId);
    if (approval.status !== 'EXECUTED') {
      return {
        success: true,
        status: 'PENDING_MULTISIG',
        proposalId,
        approvals: approval.approvals.length,
        requiredApprovals: approval.requiredApprovals,
      };
    }

    const assetId = String(approval.payload.assetId ?? '');
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('asset-not-found');

    const tokenizeHash = await this.blockchainService.sendTokenizeTx({
      name: asset.name,
      symbol: asset.symbol,
      totalSupply: parseUnits(asset.totalSupply.toString(), 18),
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.asset.update({
        where: { id: asset.id },
        data: { txHash: tokenizeHash, isActive: false, tradingStatus: 'PAUSED' },
      });
      await tx.transaction.create({
        data: {
          userId: adminId,
          type: 'MINT',
          amount: asset.totalSupply,
          fee: '0',
          status: 'PENDING',
          txHash: tokenizeHash,
        } as any,
      });
    });
    await this.assetQueue.add(
      'finalize-mint',
      {
        assetId: asset.id,
        txHash: tokenizeHash,
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return {
      success: true,
      status: 'PENDING',
      proposalId,
      txHash: tokenizeHash,
      message: 'Da gui lenh mint len blockchain, trang thai: PENDING.',
    };
  }

  async updateAsset(id: string, dto: UpdateAssetDto) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('asset-not-found');

    const hasReferencePriceUpdate =
      dto.referencePrice !== undefined && dto.referencePrice !== null;
    const hasBandUpdate =
      dto.priceBandPercentage !== undefined && dto.priceBandPercentage !== null;

    if (hasReferencePriceUpdate && new Decimal(dto.referencePrice!).lte(0)) {
      throw new BadRequestException('referencePrice must be greater than 0');
    }

    if (hasBandUpdate) {
      const band = new Decimal(dto.priceBandPercentage!);
      if (band.lt(0) || band.gte(1)) {
        throw new BadRequestException(
          'priceBandPercentage must be in range [0, 1)',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.asset.update({
        where: { id },
        data: { ...dto } as any,
      });

      if (hasReferencePriceUpdate) {
        await tx.assetValuationSnapshot.create({
          data: {
            assetId: id,
            source: 'ADMIN_REFERENCE_PRICE',
            title: 'Manual NAV update',
            price: new Decimal(dto.referencePrice!),
            currency: 'USDT',
            capturedAt: new Date(),
            rawPayload: {
              type: 'MANUAL_NAV_UPDATE',
              referencePrice: dto.referencePrice,
              priceBandPercentage: dto.priceBandPercentage ?? null,
            },
          },
        });
      }
    });
    return { success: true };
  }

  async reloadAssetConfig() {
    await Promise.resolve();
    return { success: true };
  }
}
