import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../prisma/prisma.service';
import { BlockchainService } from './blockchain.service';
import { $Enums } from '@prisma/client';

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

    if (
      !asset.isActive ||
      asset.tradingStatus !== $Enums.AssetTradingStatus.OPEN
    ) {
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

    await this.prisma.$transaction(async (tx) => {
      const txAsset = tx.asset as unknown as AssetUpdateDelegate;

      await txAsset.update({
        where: { id: assetId },
        data: {
          isActive: false,
          tradingStatus: $Enums.AssetTradingStatus.CLOSED,
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

      await tx.supportTicket.create({
        data: {
          userId,
          subject: `Redeem request for ${asset.symbol}`,
        },
      });

      await tx.auditLog.create({
        data: {
          entity: 'ASSET',
          entityId: assetId,
          action: 'REDEEM_REQUESTED',
          performedBy: userId,
          details: `User requested redeem for asset ${asset.symbol}`,
        },
      });
    });

    if (asset.contractAddress) {
      try {
        this.logger.log(
          `Redeem requested for ${asset.symbol}. Ready to burn full supply on-chain.`,
        );
        // Placeholder integration point when burn endpoint is available.
        // await this.blockchainService.burnToken(
        //   asset.contractAddress,
        //   userId,
        //   asset.totalSupply.toString(),
        // );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to submit burn transaction for asset ${asset.symbol}: ${errorMessage}`,
        );
      }
    }

    return {
      success: true,
      message:
        'Redeem request submitted. Admin will contact you to complete legal off-chain settlement.',
    };
  }
}
