import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { MarketDataService } from '../market-data/services/market-data.service';
import Decimal from 'decimal.js';
import { AppConfigService } from '@/config/app-config.service';

type DecimalValue = string | number | { toString(): string };

const toDecimalValue = (value: DecimalValue): string | number =>
  typeof value === 'string' || typeof value === 'number'
    ? value
    : value.toString();

@Injectable()
export class MarketMakerService implements OnModuleInit {
  private readonly logger = new Logger(MarketMakerService.name);

  // Bot User ID
  private readonly BOT_USER_ID = '00000000-0000-0000-0000-000000000000';

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketDataService: MarketDataService,
    private readonly config: AppConfigService,
  ) {}

  async onModuleInit() {
    if (!this.config.enableMarketMaker) return;

    // Ensure Bot user exists
    let botUser = await this.prisma.user.findUnique({
      where: { id: this.BOT_USER_ID },
    });

    if (!botUser) {
      botUser = await this.prisma.user.create({
        data: {
          id: this.BOT_USER_ID,
          email: 'bot@marketmaker.local',
          passwordHash: 'none',
          role: 'ADMIN',
          kycStatus: 'APPROVED',
        },
      });
    }

    // Ensure Bot has token balance for all active assets (Moved from loop for efficiency)
    const activeAssets = await this.prisma.asset.findMany({
      where: { isActive: true },
    });
    for (const asset of activeAssets) {
      const tokenBalance = await this.prisma.balance.findFirst({
        where: { userId: this.BOT_USER_ID, assetId: asset.id },
      });

      if (tokenBalance) {
        await this.prisma.balance.update({
          where: { id: tokenBalance.id },
          data: { available: new Decimal(1000000) },
        });
      } else {
        await this.prisma.balance.create({
          data: {
            userId: this.BOT_USER_ID,
            assetId: asset.id,
            available: new Decimal(1000000),
            locked: new Decimal(0),
          },
        });
      }
    }
  }

  // Run every 10 seconds for faster chart testing.
  @Cron('*/10 * * * * *')
  async simulateTrades() {
    if (!this.config.enableMarketMaker) return;

    // Fetch all active RWA assets.
    const assets = await this.prisma.asset.findMany({
      where: { isActive: true },
    });

    const now = new Date();

    for (const asset of assets) {
      try {
        // Fetch anchor to base trade on (Using robust Upstream logic)
        const anchor = await this.marketDataService.getReferencePriceAnchor(
          asset.id,
        );
        const refPrice =
          anchor.referencePrice ||
          anchor.valuationSnapshotPrice ||
          anchor.marketPrice ||
          asset.tokenPrice ||
          1.0;
        const currentPrice = new Decimal(
          toDecimalValue(refPrice as DecimalValue),
        );

        // Fluctuate price slightly (-1% to 1%)
        const fluctuation = (Math.random() * 2 - 1) * 0.01;
        const tradePrice = currentPrice
          .mul(new Decimal(1).plus(fluctuation))
          .toDecimalPlaces(4);

        // Generate random matched quantity (for example, 1 to 50 tokens).
        const quantity = new Decimal(Math.floor(Math.random() * 50) + 1);

        // Directly record a simulated trade bypassing the matching engine
        await this.marketDataService.recordTrade(
          asset.id,
          tradePrice.toString(),
          quantity.toString(),
          now,
        );

        this.logger.debug(
          `[Market Maker] Generated simulated trade for ${asset.symbol}: Price ${tradePrice.toString()} | Volume ${quantity.toString()}`,
        );
      } catch (error) {
        this.logger.error(
          `[Market Maker] Failed to generate data for ${asset.symbol}: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        );
      }
    }
  }
}
