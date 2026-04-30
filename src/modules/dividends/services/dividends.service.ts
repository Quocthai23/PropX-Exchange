import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { createHash } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { BalancesService } from '../../balances/services/balances.service';
import { CreateDistributionDto } from '../dto/create-distribution.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

type DecimalValue = string | number | { toString(): string };

const toDecimalValue = (value: DecimalValue): string | number =>
  typeof value === 'string' || typeof value === 'number'
    ? value
    : value.toString();

const hashLeaf = (userId: string, amount: string): string =>
  createHash('sha256').update(`${userId}:${amount}`).digest('hex');

const hashPair = (left: string, right: string): string =>
  createHash('sha256').update([left, right].sort().join('')).digest('hex');

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

export interface DividendDistributionRecord {
  id: string;
  assetId: string;
  totalAmount: DecimalValue;
}

export interface DividendClaimRecord {
  id: string;
  distributionId: string;
  userId: string;
  amount: DecimalValue;
  status: string;
}

type ClaimableDividend = DividendClaimRecord & {
  distribution: {
    asset: {
      symbol: string;
      name: string;
    };
  };
};

interface DividendsTransaction {
  dividendDistribution: {
    update(args: {
      where: { id: string };
      data: { status: string };
    }): Promise<DividendDistributionRecord>;
  };
  dividendClaim: {
    createMany(args: {
      data: {
        distributionId: string;
        userId: string;
        amount: string;
        status: string;
      }[];
      skipDuplicates?: boolean;
    }): Promise<unknown>;
    findUnique(args: {
      where: {
        distributionId_userId: { distributionId: string; userId: string };
      };
    }): Promise<DividendClaimRecord | null>;
    update(args: {
      where: { id: string };
      data: { status: string; claimedAt: Date };
    }): Promise<DividendClaimRecord>;
  };
  balance: {
    findMany(args: {
      where: {
        assetId: string;
        OR: { available?: { gt: string }; locked?: { gt: string } }[];
      };
    }): Promise<
      {
        userId: string;
        available: DecimalValue;
        locked: DecimalValue;
      }[]
    >;
    upsert(args: {
      where: { userId_assetId: { userId: string; assetId: string } };
      update: { available: { increment: DecimalValue } };
      create: {
        userId: string;
        assetId: string;
        available: DecimalValue;
        locked: DecimalValue;
      };
    }): Promise<unknown>;
  };
  transaction: {
    create(args: {
      data: {
        userId: string;
        type: string;
        amount: DecimalValue;
        fee: DecimalValue;
        status: string;
      };
    }): Promise<unknown>;
  };
}

interface DividendsPrisma {
  asset: {
    findUnique(args: {
      where: { id: string };
    }): Promise<{ symbol: string; totalSupply: DecimalValue } | null>;
  };
  auditLog: {
    create(args: {
      data: {
        entity: string;
        entityId: string;
        action: string;
        performedBy: string;
        details: string;
      };
    }): Promise<unknown>;
  };
  dividendDistribution: {
    create(args: {
      data: {
        assetId: string;
        totalAmount: DecimalValue;
        snapshotDate: Date;
        status: string;
      };
    }): Promise<DividendDistributionRecord>;
    findMany(args: {
      where: {
        status: 'PENDING';
        snapshotDate: { lte: Date };
      };
    }): Promise<DividendDistributionRecord[]>;
  };
  dividendClaim: {
    findMany(args: {
      where: { userId: string; status: 'PENDING' };
      include: {
        distribution: {
          include: { asset: { select: { symbol: true; name: true } } };
        };
      };
      orderBy: { createdAt: 'desc' };
    }): Promise<ClaimableDividend[]>;
  };
  $transaction<T>(fn: (tx: DividendsTransaction) => Promise<T>): Promise<T>;
}

@Injectable()
export class DividendsService {
  private readonly logger = new Logger(DividendsService.name);
  private static readonly SNAPSHOT_BATCH_SIZE = 500;

  constructor(
    private prisma: PrismaService,
    private readonly balancesService: BalancesService,
    @InjectQueue('merkle-tree') private readonly merkleTreeQueue: Queue,
  ) {}

  async createDistribution(adminId: string, dto: CreateDistributionDto) {
    const snapshotDate = dto.snapshotDate
      ? new Date(dto.snapshotDate)
      : new Date();

    const prisma = this.prisma as unknown as DividendsPrisma;

    const asset = await prisma.asset.findUnique({
      where: { id: dto.assetId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found.');
    }

    const distribution = await prisma.dividendDistribution.create({
      data: {
        assetId: dto.assetId,
        totalAmount: dto.totalAmount,
        snapshotDate,
        status: 'PENDING',
      },
    });

    await prisma.auditLog.create({
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
    const prisma = this.prisma as unknown as DividendsPrisma;

    const pendingDistributions = await prisma.dividendDistribution.findMany({
      where: {
        status: 'PENDING',
        snapshotDate: { lte: new Date() },
      },
    });

    for (const dist of pendingDistributions) {
      try {
        const asset = await prisma.asset.findUnique({
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
    const prisma = this.prisma as unknown as DividendsPrisma;

    return prisma.dividendClaim.findMany({
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
    const prisma = this.prisma as unknown as DividendsPrisma;

    return prisma.$transaction(async (tx) => {
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
        { tx: tx as any },
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

      return { message: 'Dividend claimed successfully', amount: claim.amount };
    });
  }

  async getClaimProof(userId: string, distributionId: string) {
    const claims = await this.prisma.dividendClaim.findMany({
      where: { distributionId },
      orderBy: { userId: 'asc' },
      select: { userId: true, amount: true },
    });
    if (claims.length === 0) {
      throw new NotFoundException('Distribution claims not generated yet.');
    }

    const claimIndex = claims.findIndex((c) => c.userId === userId);
    if (claimIndex === -1) {
      throw new NotFoundException('No claim found for this user.');
    }

    const leaves = claims.map((c) => hashLeaf(c.userId, c.amount.toString()));
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
}
