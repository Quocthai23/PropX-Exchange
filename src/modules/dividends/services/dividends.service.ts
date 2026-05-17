import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { ethers } from 'ethers';
import { PrismaService } from '@/prisma/prisma.service';
import { BalancesService } from '../../balances/services/balances.service';
import { CreateDistributionDto } from '../dto/create-distribution.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CommissionsService } from '../../commissions/commissions.service';
import { CommissionEvent } from '@prisma/client';

type DecimalValue = string | number | { toString(): string };

const toDecimalValue = (value: DecimalValue): string | number =>
  typeof value === 'string' || typeof value === 'number'
    ? value
    : value.toString();

const hashLeaf = (walletAddress: string, amount: string): string => {
  const amountWei = ethers.parseUnits(Number(amount).toFixed(6), 6).toString();
  return ethers.solidityPackedKeccak256(
    ['address', 'uint256'],
    [walletAddress, amountWei],
  );
};

const hashPair = (left: string, right: string): string => {
  const [a, b] = [left, right].sort();
  return ethers.solidityPackedKeccak256(['bytes32', 'bytes32'], [a, b]);
};

const buildMerkleTree = (leaves: string[]): string[][] => {
  if (leaves.length === 0) return [['']];
  const layers: string[][] = [leaves];
  while (layers[layers.length - 1].length > 1) {
    const prev = layers[layers.length - 1];
    const next: string[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const left = prev[i];
      const right = prev[i + 1] ?? prev[i];
      next.push(hashPair(left, right));
    }
    layers.push(next);
  }
  return layers;
};

const buildMerkleProof = (leaves: string[], index: number): string[] => {
  if (leaves.length === 0 || index < 0 || index >= leaves.length) return [];
  const proof: string[] = [];
  let idx = index;
  let layer = leaves;
  while (layer.length > 1) {
    const isRightNode = idx % 2 === 1;
    const siblingIndex = isRightNode ? idx - 1 : idx + 1;
    proof.push(layer[siblingIndex] ?? layer[idx]);

    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      next.push(hashPair(layer[i], layer[i + 1] ?? layer[i]));
    }
    idx = Math.floor(idx / 2);
    layer = next;
  }
  return proof;
};



@Injectable()
export class DividendsService {
  private readonly logger = new Logger(DividendsService.name);
  private static readonly SNAPSHOT_BATCH_SIZE = 500;

  constructor(
    private prisma: PrismaService,
    private readonly balancesService: BalancesService,
    private readonly commissionsService: CommissionsService,
    @InjectQueue('merkle-tree') private readonly merkleTreeQueue: Queue,
  ) {}

  async createDistribution(adminId: string, dto: CreateDistributionDto) {
    const snapshotDate = dto.snapshotDate
      ? new Date(dto.snapshotDate)
      : new Date();

    const asset = await this.prisma.asset.findUnique({
      where: { id: dto.assetId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found.');
    }

    const distribution = await this.prisma.dividendDistribution.create({
      data: {
        assetId: dto.assetId,
        totalAmount: dto.totalAmount,
        snapshotDate,
        status: 'PENDING',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        entity: 'DIVIDEND_DISTRIBUTION',
        entityId: distribution.id,
        action: 'CREATED',
        performedBy: adminId,
        details: `Created dividend distribution for asset ${asset.symbol}. Amount: ${dto.totalAmount} USDT. Snapshot at: ${snapshotDate.toISOString()}`,
      },
    });

    return distribution;
  }

  async processSnapshots() {
    const pendingDistributions = await this.prisma.dividendDistribution.findMany({
      where: {
        status: 'PENDING',
        snapshotDate: { lte: new Date() },
      },
    });

    for (const dist of pendingDistributions) {
      try {
        const asset = await this.prisma.asset.findUnique({
          where: { id: dist.assetId },
        });
        if (!asset) {
          throw new NotFoundException(`Asset ${dist.assetId} not found`);
        }

        const totalSupply = new Decimal(toDecimalValue(asset.totalSupply));
        if (totalSupply.lte(0)) {
          throw new BadRequestException(
            `Asset ${dist.assetId} has invalid totalSupply`,
          );
        }

        const totalDividendDec = new Decimal(toDecimalValue(dist.totalAmount));
        let cursorId: string | undefined;
        let totalClaims = 0;
        let totalClaimedOnExchange = new Decimal(0);

        while (true) {
          const holdings = await this.prisma.balance.findMany({
            where: {
              assetId: dist.assetId,
              OR: [{ available: { gt: '0' } }, { locked: { gt: '0' } }],
            },
            orderBy: { id: 'asc' },
            take: DividendsService.SNAPSHOT_BATCH_SIZE,
            ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
            select: {
              id: true,
              userId: true,
              available: true,
              locked: true,
            },
          });

          if (holdings.length === 0) {
            break;
          }

          cursorId = holdings[holdings.length - 1].id;

          const claimsData = holdings
            .map((holding) => {
              const userTotal = new Decimal(
                toDecimalValue(holding.available),
              ).plus(toDecimalValue(holding.locked));
              const userShareRatio = userTotal.div(totalSupply);
              const userPayout = totalDividendDec.times(userShareRatio);
              return {
                distributionId: dist.id,
                userId: holding.userId,
                amount: userPayout.toString(),
                status: 'PENDING',
              };
            })
            .filter((c) => new Decimal(c.amount).gt(0));

          if (claimsData.length > 0) {
            await this.prisma.dividendClaim.createMany({
              data: claimsData,
              skipDuplicates: true,
            });
            totalClaims += claimsData.length;
            totalClaimedOnExchange = totalClaimedOnExchange.plus(
              claimsData.reduce(
                (sum, claim) => sum.plus(claim.amount),
                new Decimal(0),
              ),
            );
          }
        }

        await this.prisma.dividendDistribution.update({
          where: { id: dist.id },
          data: { status: totalClaims > 0 ? 'READY_FOR_CLAIM' : 'COMPLETED' },
        });

        const treasuryAmount = Decimal.max(
          totalDividendDec.minus(totalClaimedOnExchange),
          0,
        );
        if (treasuryAmount.gt(0)) {
          this.logger.warn(
            `Distribution ${dist.id} has unallocated treasury amount ${treasuryAmount.toString()} for off-exchange holders.`,
          );
        }
        this.logger.log(
          `Processed snapshot for distribution ${dist.id}. Created ${totalClaims} claims.`,
        );

        await this.merkleTreeQueue.add('build', { distributionId: dist.id });
      } catch (error) {
        this.logger.error(
          `Failed to process snapshot for distribution ${dist.id}`,
          error,
        );
      }
    }
  }

  getClaimableDividends(userId: string) {
    return this.prisma.dividendClaim.findMany({
      where: { userId, status: 'PENDING' },
      include: {
        distribution: {
          include: { asset: { select: { symbol: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async claimDividend(userId: string, distributionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.dividendClaim.findUnique({
        where: { distributionId_userId: { distributionId, userId } },
      });

      if (!claim)
        throw new NotFoundException(
          'No dividend claim found for this distribution.',
        );
      if (claim.status === 'CLAIMED')
        throw new BadRequestException(
          'This dividend has already been claimed.',
        );

      const updated = await tx.dividendClaim.updateMany({
        where: { id: claim.id, status: 'PENDING' },
        data: { status: 'CLAIMED', claimedAt: new Date() },
      });

      if (updated.count === 0) {
        throw new BadRequestException(
          'This dividend has already been claimed or does not exist.',
        );
      }

      // Add USDT to user's balance using BalancesService
      await this.balancesService.updateBalance(
        userId,
        null,
        new Decimal(toDecimalValue(claim.amount)),
        'credit',
        { tx },
      );

      // Create Transaction Record
      await tx.transaction.create({
        data: {
          userId,
          type: 'DIVIDEND_CLAIM',
          amount: claim.amount,
          fee: '0',
          status: 'COMPLETED',
        },
      });

      // Trigger YIELD commission
      await this.commissionsService.triggerCommission({
        eventType: CommissionEvent.YIELD,
        sourceUserId: userId,
        amount: Number(toDecimalValue(claim.amount)),
        sourceTxId: claim.id,
        currency: 'USDT',
      });

      return { message: 'Dividend claimed successfully', amount: claim.amount };
    });
  }

  async getClaimProof(userId: string, distributionId: string) {
    const claims = await this.prisma.dividendClaim.findMany({
      where: { distributionId },
      orderBy: { userId: 'asc' },
      select: {
        userId: true,
        amount: true,
        user: { select: { walletAddress: true } },
      },
    });
    if (claims.length === 0) {
      throw new NotFoundException('Distribution claims not generated yet.');
    }

    const claimIndex = claims.findIndex((c) => c.userId === userId);
    if (claimIndex === -1) {
      throw new NotFoundException('No claim found for this user.');
    }

    const leaves = claims.map((c) => {
      const wallet =
        c.user?.walletAddress || '0x0000000000000000000000000000000000000000';
      return hashLeaf(wallet, c.amount.toString());
    });
    const tree = buildMerkleTree(leaves);
    const merkleRoot = tree[tree.length - 1][0] ?? '';
    const proof = buildMerkleProof(leaves, claimIndex);

    return {
      distributionId,
      userId,
      amount: claims[claimIndex].amount.toString(),
      merkleRoot,
      proof,
    };
  }

  async processInterestPayments() {
    // 1. Find all PENDING interest payments that are past their due date
    const pendingLate = await this.prisma.interestPaymentRequest.findMany({
      where: {
        status: 'PENDING',
        dueDate: { lte: new Date() },
      },
      include: { asset: true },
    });

    for (const payment of pendingLate) {
      // 2. Mark as LATE
      await this.prisma.interestPaymentRequest.update({
        where: { id: payment.id },
        data: { status: 'LATE' },
      });

      // 3. Deduct tokens from retained pool and release to market if penalty applies
      const penaltyRate = payment.asset.penaltyRate ?? new Decimal(0.05);
      if (penaltyRate.gt(0) && payment.asset.retainedTokenPercentage.gt(0)) {
        const penaltyPercentage =
          payment.asset.retainedTokenPercentage.times(penaltyRate);
        const newRetained =
          payment.asset.retainedTokenPercentage.minus(penaltyPercentage);
        const newReleased =
          payment.asset.releasedTokenPercentage.plus(penaltyPercentage);

        await this.prisma.asset.update({
          where: { id: payment.asset.id },
          data: {
            retainedTokenPercentage: newRetained,
            releasedTokenPercentage: newReleased,
          },
        });

        // TODO: Create a DividendDistribution for the penalty tokens or trigger an Airdrop
        this.logger.log(
          `Applied penalty of ${penaltyPercentage}% for asset ${payment.asset.symbol} due to late interest payment.`,
        );
      }
    }
  }
}
