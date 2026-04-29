import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { parseUnits } from 'ethers';
import { PrismaService } from '@/prisma/prisma.service';
import { BlockchainService } from './blockchain.service';
import { $Enums } from '@prisma/client';
import { MultiSigService } from '@/shared/services/multisig.service';
import { AdminUpdateRedemptionDto } from '../dto/redeem-asset.dto';

const DEFAULT_ASSET_TOKEN_DECIMALS = 18;

interface AssetRedeemView {
  id: string;
  symbol: string;
  totalSupply: Decimal.Value;
  contractAddress: string | null;
  isActive: boolean;
  tradingStatus: string;
}

interface AssetRedeemDelegate {
  findUnique(args: {
    where: { id: string };
    select: {
      id: true;
      symbol: true;
      totalSupply: true;
      contractAddress: true;
      isActive: true;
      tradingStatus: true;
    };
  }): Promise<AssetRedeemView | null>;
}

interface AssetUpdateDelegate {
  update(args: {
    where: { id: string };
    data: {
      isActive: boolean;
      tradingStatus: string;
    };
  }): Promise<unknown>;
}

@Injectable()
export class RedeemService {
  private readonly logger = new Logger(RedeemService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    private readonly multiSigService: MultiSigService,
  ) {}

  async requestRedeem(userId: string, assetId: string) {
    const prisma = this.prisma as PrismaService & {
      asset: AssetRedeemDelegate;
    };

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, kycStatus: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.kycStatus !== $Enums.KycStatus.APPROVED) {
      throw new BadRequestException(
        'Redeem request requires approved KYC status.',
      );
    }

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        symbol: true,
        totalSupply: true,
        contractAddress: true,
        isActive: true,
        tradingStatus: true,
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found.');
    }

    if (!asset.isActive || asset.tradingStatus !== $Enums.AssetTradingStatus.OPEN) {
      throw new BadRequestException(
        `Asset ${asset.symbol} is not eligible for redeem at this time.`,
      );
    }

    const userBalance = await this.prisma.balance.findFirst({
      where: { userId, assetId },
      select: { id: true, available: true, locked: true },
    });

    const totalSupplyDec = new Decimal(asset.totalSupply);
    const userAvailableDec = new Decimal(userBalance?.available ?? 0);

    if (!userBalance || userAvailableDec.lt(totalSupplyDec)) {
      throw new BadRequestException(
        'You must hold 100% of total supply in available balance to request full redeem.',
      );
    }

    const redemptionRequest = await this.prisma.$transaction(async (tx) => {
      const txAsset = tx.asset as unknown as AssetUpdateDelegate;

      // Pause trading while redemption is handled off-chain
      await txAsset.update({
        where: { id: assetId },
        data: {
          isActive: false,
          tradingStatus: $Enums.AssetTradingStatus.PAUSED,
        },
      });

      await tx.order.updateMany({
        where: {
          assetId,
          status: {
            in: [
              $Enums.OrderStatus.PENDING,
              $Enums.OrderStatus.OPEN,
              $Enums.OrderStatus.PARTIALLY_FILLED,
            ],
          },
        },
        data: { status: $Enums.OrderStatus.CANCELLED },
      });

      await tx.balance.update({
        where: { id: userBalance.id },
        data: {
          available: '0',
          locked: new Decimal(userBalance.locked)
            .add(userBalance.available)
            .toString(),
        },
      });

      const redemption = await tx.assetRedemptionRequest.create({
        data: {
          userId,
          assetId,
          tokenQuantity: totalSupplyDec,
          status: $Enums.RedemptionStatus.PENDING,
        },
      });

      await tx.supportTicket.create({
        data: {
          userId,
          subject: `Asset redemption request for ${asset.symbol}`,
        },
      });

      await tx.auditLog.create({
        data: {
          entity: 'ASSET_REDEMPTION_REQUEST',
          entityId: redemption.id,
          action: 'CREATED',
          performedBy: userId,
          details: `User requested redemption for asset ${asset.symbol}`,
        },
      });

      return redemption;
    });

    return {
      success: true,
      message:
        'Redeem request submitted. Admin will contact you to complete legal off-chain settlement.',
      redemptionRequestId: redemptionRequest.id,
    };
  }

  async listRedemptionRequests() {
    const data = await this.prisma.assetRedemptionRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, walletAddress: true } },
        asset: { select: { id: true, symbol: true, contractAddress: true } },
      },
    });
    return { data, total: data.length };
  }

  async updateRedemptionStatus(
    redemptionId: string,
    adminId: string,
    dto: AdminUpdateRedemptionDto,
  ) {
    const existing = await this.prisma.assetRedemptionRequest.findUnique({
      where: { id: redemptionId },
      include: { asset: { select: { symbol: true } } },
    });
    if (!existing) throw new NotFoundException('redemption-request-not-found');

    if (existing.status === $Enums.RedemptionStatus.COMPLETED) {
      throw new BadRequestException('redemption-request-already-completed');
    }

    const data: Record<string, unknown> = {
      status: dto.status,
    };
    if (dto.legalTransferDocs !== undefined) {
      data.legalTransferDocs = dto.legalTransferDocs;
    }

    const updated = await this.prisma.assetRedemptionRequest.update({
      where: { id: redemptionId },
      data: data as any,
    });

    await this.prisma.auditLog.create({
      data: {
        entity: 'ASSET_REDEMPTION_REQUEST',
        entityId: redemptionId,
        action: `STATUS_${dto.status}`,
        performedBy: adminId,
        details: `Admin updated redemption for ${existing.asset.symbol}`,
      },
    });

    return { success: true, data: updated };
  }

  async completeRedemption(redemptionId: string, adminId: string) {
    const req = await this.prisma.assetRedemptionRequest.findUnique({
      where: { id: redemptionId },
      include: { asset: true, user: { select: { id: true } } },
    });
    if (!req) throw new NotFoundException('redemption-request-not-found');

    if (req.status !== $Enums.RedemptionStatus.PROCESSING_LEGAL) {
      throw new BadRequestException(
        `invalid-status: expected PROCESSING_LEGAL, got ${req.status}`,
      );
    }

    if (!req.asset.contractAddress) {
      throw new BadRequestException('asset-missing-contractAddress');
    }

    const burnTxHash = await this.blockchainService.burnAssetToken({
      assetAddress: req.asset.contractAddress,
      amount: parseUnits(
        new Decimal(req.tokenQuantity as any).toString(),
        DEFAULT_ASSET_TOKEN_DECIMALS,
      ),
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.assetRedemptionRequest.update({
        where: { id: redemptionId },
        data: {
          status: $Enums.RedemptionStatus.COMPLETED,
          burnTxHash,
        },
      });

      await tx.transaction.create({
        data: {
          userId: req.userId,
          type: $Enums.TransactionType.BURN,
          amount: new Decimal(req.tokenQuantity as any),
          fee: new Decimal(0),
          status: $Enums.TransactionStatus.COMPLETED,
          txHash: burnTxHash,
          confirmations: 0,
        } as any,
      });

      await tx.asset.update({
        where: { id: req.assetId },
        data: {
          isActive: false,
          tradingStatus: $Enums.AssetTradingStatus.CLOSED,
        },
      });

      await tx.auditLog.create({
        data: {
          entity: 'ASSET_REDEMPTION_REQUEST',
          entityId: redemptionId,
          action: 'COMPLETED',
          performedBy: adminId,
          details: `Burn completed. txHash=${burnTxHash}`,
        },
      });
    });

    return { success: true, burnTxHash };
  }
}
