import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../prisma/prisma.service';
import { BalancesService } from '../../balances/services/balances.service';
import { CreateDistributionDto } from '../dto/create-distribution.dto';

type DecimalValue = string | number | { toString(): string };

const toDecimalValue = (value: DecimalValue): string | number =>
  typeof value === 'string' || typeof value === 'number'
    ? value
    : value.toString();

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
    }): Promise<{ symbol: string } | null>;
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

  constructor(
    private prisma: PrismaService,
    private readonly balancesService: BalancesService,
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
        await prisma.$transaction(async (tx) => {
          const holdings = await tx.balance.findMany({
            where: {
              assetId: dist.assetId,
              OR: [{ available: { gt: '0' } }, { locked: { gt: '0' } }],
            },
          });

          if (holdings.length === 0) {
            await tx.dividendDistribution.update({
              where: { id: dist.id },
              data: { status: 'COMPLETED' },
            });
            return;
          }

          const totalSupplyHeld = holdings.reduce(
            (sum, holding) =>
              sum
                .plus(toDecimalValue(holding.available))
                .plus(toDecimalValue(holding.locked)),
            new Decimal(0),
          );

          const totalDividendDec = new Decimal(
            toDecimalValue(dist.totalAmount),
          );
          const claimsData = holdings.map((holding) => {
            const userTotal = new Decimal(
              toDecimalValue(holding.available),
            ).plus(toDecimalValue(holding.locked));
            const userShareRatio = userTotal.div(totalSupplyHeld);
            const userPayout = totalDividendDec.times(userShareRatio);

            return {
              distributionId: dist.id,
              userId: holding.userId,
              amount: userPayout.toString(),
              status: 'PENDING',
            };
          });

          const validClaims = claimsData.filter((c) =>
            new Decimal(c.amount).gt(0),
          );

          if (validClaims.length > 0) {
            await tx.dividendClaim.createMany({
              data: validClaims,
            });
          }

          await tx.dividendDistribution.update({
            where: { id: dist.id },
            data: { status: 'READY_FOR_CLAIM' },
          });

          this.logger.log(
            `Processed snapshot for distribution ${dist.id}. Created ${validClaims.length} claims.`,
          );
        });
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

      await tx.dividendClaim.update({
        where: { id: claim.id },
        data: { status: 'CLAIMED', claimedAt: new Date() },
      });

      // Add USDT to user's balance using BalancesService
      await this.balancesService.updateBalance(
        userId,
        null,
        new Decimal(toDecimalValue(claim.amount)),
        'credit',
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
}
