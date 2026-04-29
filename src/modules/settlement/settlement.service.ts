import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma/prisma.service';
import { BlockchainService } from '../assets/services/blockchain.service';
import { AppConfigService } from '@/config/app-config.service';

interface SettlementTrade {
  id: string;
  assetId: string;
  asset: {
    contractAddress: string | null;
    symbol: string;
  };
  buyer: {
    walletAddress: string | null;
  };
  seller: {
    walletAddress: string | null;
  };
  quantity: {
    toString(): string;
  };
}

interface SettlementPrisma {
  trade: {
    findMany: (args: {
      where: { settlementStatus: 'PENDING' };
      include: {
        asset: true;
        buyer: true;
        seller: true;
      };
      take: number;
    }) => Promise<SettlementTrade[]>;
    updateMany: (args: {
      where: { id: { in: string[] } };
      data: {
        settlementStatus: 'PROCESSING' | 'SETTLED' | 'FAILED';
        txHash?: string;
      };
    }) => Promise<unknown>;
  };
}

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    private readonly config: AppConfigService,
  ) {}

  // Run every 5 minutes to batch and submit settlements on-chain.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processSettlements() {
    if (!this.config.enableSettlement) return;

    this.logger.log('Starting batch settlement process...');

    // 1. Fetch up to 100 matched off-chain trades that are still unsettled.
    const settlementPrisma = this.prisma as PrismaService & SettlementPrisma;
    const pendingTrades = await settlementPrisma.trade.findMany({
      where: { settlementStatus: 'PENDING' },
      include: {
        asset: true,
        buyer: true,
        seller: true,
      },
      take: 100,
    });

    if (pendingTrades.length === 0) return;

    // 2. Group by asset type (each RWA token has its own contract).
    const tradesByAsset = pendingTrades.reduce<
      Record<string, SettlementTrade[]>
    >((acc, trade) => {
      if (!acc[trade.assetId]) acc[trade.assetId] = [];
      acc[trade.assetId].push(trade);
      return acc;
    }, {});

    // 3. Process each group and synchronize to the network.
    for (const trades of Object.values(tradesByAsset)) {
      const asset = trades[0].asset;

      if (!asset.contractAddress) continue;

      try {
        const missingWalletTrades = trades.filter(
          (t) => !t.buyer.walletAddress || !t.seller.walletAddress,
        );
        if (missingWalletTrades.length > 0) {
          await settlementPrisma.trade.updateMany({
            where: { id: { in: missingWalletTrades.map((t) => t.id) } },
            data: { settlementStatus: 'FAILED' },
          });
        }

        const eligibleTrades = trades.filter(
          (t) => t.buyer.walletAddress && t.seller.walletAddress,
        );
        if (eligibleTrades.length === 0) continue;

        // Lock status to prevent duplicate pickup in the next cron run.
        await settlementPrisma.trade.updateMany({
          where: { id: { in: eligibleTrades.map((t) => t.id) } },
          data: { settlementStatus: 'PROCESSING' },
        });

        const settlementData = eligibleTrades.map((t) => ({
          from: t.seller.walletAddress!,
          to: t.buyer.walletAddress!,
          amount: new Decimal(t.quantity.toString()),
        }));

        // Submit on-chain transaction
        const txHash = this.blockchainService.batchSettleTrades(
          asset.contractAddress,
          settlementData,
        );

        // Update successful settlement results
        await settlementPrisma.trade.updateMany({
          where: { id: { in: eligibleTrades.map((t) => t.id) } },
          data: { settlementStatus: 'SETTLED', txHash },
        });

        this.logger.log(
          `Successfully settled ${eligibleTrades.length} trades for ${asset.symbol}. TxHash: ${txHash}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to settle trades for asset ${asset.symbol}`,
          error,
        );
        // Change status so it can be retried in the next run.
        await settlementPrisma.trade.updateMany({
          where: { id: { in: trades.map((t) => t.id) } },
          data: { settlementStatus: 'FAILED' },
        });
      }
    }
  }
}
