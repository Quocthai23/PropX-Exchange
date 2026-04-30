import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { OrdersService } from '../orders/services/orders.service';
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
    private readonly ordersService: OrdersService,
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
          idNumber: 'BOT-001',
        },
      });
    }

    // Ensure USDT balance for bot (null assetId)
    const usdtBalance = await this.prisma.balance.findFirst({
      where: { userId: this.BOT_USER_ID, assetId: null },
    });

    if (usdtBalance) {
      await this.prisma.balance.update({
        where: { id: usdtBalance.id },
        data: { available: new Decimal(10000000) },
      });
    } else {
      await this.prisma.balance.create({
        data: {
          userId: this.BOT_USER_ID,
          assetId: null,
          available: new Decimal(10000000),
          locked: new Decimal(0),
        },
      });
    }
  }

  // Run every 30 seconds.
  @Cron('*/30 * * * * *')
  async simulateTrades() {
    // Use environment variable to enable/disable the bot and avoid unnecessary DB noise.
    if (!this.config.enableMarketMaker) return;

    // Cancel old BOT orders to prevent infinite buildup
    const openOrders = await this.prisma.order.findMany({
      where: {
        userId: this.BOT_USER_ID,
        status: { in: ['OPEN', 'PARTIALLY_FILLED'] },
      },
      select: { id: true },
    });

    if (openOrders.length > 0) {
      await this.ordersService.bulkCancelOrders(this.BOT_USER_ID, {
        orderIds: openOrders.map((o) => o.id),
      });
    }

    // Fetch all active RWA assets.
    const assets = await this.prisma.asset.findMany({
      where: { isActive: true },
    });

    for (const asset of assets) {
      try {
        // Ensure bot has token balance
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

        // Anchor NAV logic: Bot always places orders around Reference Price
        const currentPrice = asset.referencePrice
          ? new Decimal(toDecimalValue(asset.referencePrice))
          : new Decimal(toDecimalValue(asset.tokenPrice));

        // Spread logic (e.g., 1% spread from NAV)
        const spreadFactor = 0.01;
        const bidPrice = currentPrice.mul(1 - spreadFactor).toDecimalPlaces(4);
        const askPrice = currentPrice.mul(1 + spreadFactor).toDecimalPlaces(4);

        // Generate random matched quantity (for example, 1 to 50 tokens).
        const quantity = new Decimal(Math.floor(Math.random() * 50) + 1);

        // Place real LIMIT orders via the normal Matching function
        await this.ordersService.createOrder(this.BOT_USER_ID, {
          assetId: asset.id,
          type: 'LIMIT',
          side: 'BUY',
          price: bidPrice.toString(),
          quantity: quantity.toString(),
        });

        await this.ordersService.createOrder(this.BOT_USER_ID, {
          assetId: asset.id,
          type: 'LIMIT',
          side: 'SELL',
          price: askPrice.toString(),
          quantity: quantity.toString(),
        });

        this.logger.debug(
          `[Market Maker] Placed Limit orders for ${asset.symbol}: Bid ${bidPrice.toString()} | Ask ${askPrice.toString()} | Volume ${quantity.toString()}`,
        );
      } catch (error) {
        this.logger.error(
          `[Market Maker] Failed to generate data for ${asset.symbol}`,
          error,
        );
      }
    }
  }
}
