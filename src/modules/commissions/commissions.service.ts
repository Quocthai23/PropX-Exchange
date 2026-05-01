import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CommissionEvent, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { UpdateCommissionConfigDto, GetRewardsQueryDto, ClaimRewardsDto } from './dto/commission.dto';
import { ethers } from 'ethers';
export interface CommissionJobData {
  eventType: CommissionEvent;
  sourceUserId: string;
  amount: number;       // The base amount (e.g. fee paid, yield amount)
  sourceTxId?: string;  // Tx that triggered this
  currency?: string;    // e.g. USDT
}

@Injectable()
export class CommissionsService {
  constructor(
    @InjectQueue('commissions')
    private readonly commissionsQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async triggerCommission(data: CommissionJobData) {
    await this.commissionsQueue.add('process-commission', data, {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  async getConfigs() {
    return this.prisma.commissionConfig.findMany({
      orderBy: { eventType: 'asc' },
    });
  }

  async updateConfig(eventType: CommissionEvent, dto: UpdateCommissionConfigDto) {
    return this.prisma.commissionConfig.upsert({
      where: { eventType },
      update: {
        ...(dto.commissionRate !== undefined && { commissionRate: dto.commissionRate }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      create: {
        eventType,
        commissionRate: dto.commissionRate ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async getUserRewards(userId: string, query: GetRewardsQueryDto) {
    const { skip = 0, take = 10, eventType } = query;
    
    const where: Prisma.CommissionRewardWhereInput = {
      userId,
      ...(eventType && { eventType }),
    };

    const [items, total] = await Promise.all([
      this.prisma.commissionReward.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          sourceUser: {
            select: {
              id: true,
              displayName: true,
              email: true,
            }
          }
        }
      }),
      this.prisma.commissionReward.count({ where })
    ]);

    return { items, total };
  }

  async getUserStats(userId: string) {
    const rewards = await this.prisma.commissionReward.groupBy({
      by: ['eventType', 'currency'],
      where: {
        userId,
        status: { in: ['AVAILABLE', 'CLAIMED'] },
      },
      _sum: {
        amount: true,
      },
    });

    const totalByCurrency = rewards.reduce((acc, curr) => {
      const amount = curr._sum?.amount?.toNumber() || 0;
      acc[curr.currency] = (acc[curr.currency] || 0) + amount;
      return acc;
    }, {} as Record<string, number>);

    return {
      rewardsByEvent: rewards.map(r => ({
        eventType: r.eventType,
        currency: r.currency,
        totalAmount: r._sum?.amount?.toNumber() || 0,
      })),
      totalByCurrency,
    };
  }

  async generateClaimSignature(userId: string, dto: ClaimRewardsDto) {
    const rewards = await this.prisma.commissionReward.findMany({
      where: {
        id: { in: dto.rewardIds },
        userId,
      },
    });

    if (rewards.length === 0) {
      throw new BadRequestException('No valid rewards found for claiming.');
    }

    const invalidRewards = rewards.filter(r => {
      if (r.status === 'CLAIMED' || r.status === 'REJECTED') return true;
      if (r.status === 'PENDING' && r.unlockAt && r.unlockAt > new Date()) return true;
      return false;
    });

    if (invalidRewards.length > 0) {
      throw new BadRequestException('Some rewards are not available for claiming or are still locked.');
    }

    const currencies = new Set(rewards.map(r => r.currency));
    if (currencies.size > 1) {
      throw new BadRequestException('Cannot claim multiple currencies in a single transaction.');
    }

    const currency = Array.from(currencies)[0];
    const totalAmount = rewards.reduce((sum, r) => sum + r.amount.toNumber(), 0);

    const nonce = Date.now();
    const amountWei = ethers.parseUnits(totalAmount.toString(), 18);
    
    // Hash message for Smart Contract
    const messageHash = ethers.solidityPackedKeccak256(
      ['string', 'string', 'uint256', 'uint256'],
      [userId, currency, amountWei, nonce]
    );

    // Note: In production, substitute with AwsKmsSigner
    const privateKey = process.env.ADMIN_PRIVATE_KEY || ethers.Wallet.createRandom().privateKey;
    const wallet = new ethers.Wallet(privateKey);
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    return {
      userId,
      currency,
      totalAmount,
      totalAmountWei: amountWei.toString(),
      nonce,
      signature,
      signerAddress: wallet.address,
      rewardIds: dto.rewardIds,
    };
  }
}
