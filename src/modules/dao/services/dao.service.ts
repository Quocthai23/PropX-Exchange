import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateProposalDto } from '../dto/create-proposal.dto';
import { VoteProposalDto } from '../dto/vote-proposal.dto';
import { $Enums } from '@prisma/client';

@Injectable()
export class DaoService {
  constructor(private readonly prisma: PrismaService) {}

  async createProposal(userId: string, assetId: string, dto: CreateProposalDto) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('asset-not-found');

    const snapshotDate = new Date(dto.snapshotDate);
    const endDate = new Date(dto.endDate);

    if (!(snapshotDate instanceof Date) || Number.isNaN(snapshotDate.valueOf())) {
      throw new BadRequestException('invalid-snapshotDate');
    }
    if (!(endDate instanceof Date) || Number.isNaN(endDate.valueOf())) {
      throw new BadRequestException('invalid-endDate');
    }
    if (endDate <= snapshotDate) {
      throw new BadRequestException('endDate-must-be-after-snapshotDate');
    }

    const proposal = await this.prisma.daoProposal.create({
      data: {
        assetId,
        proposerId: userId,
        title: dto.title,
        description: dto.description,
        snapshotDate,
        endDate,
        status: $Enums.ProposalStatus.ACTIVE,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        entity: 'DAO_PROPOSAL',
        entityId: proposal.id,
        action: 'CREATED',
        performedBy: userId,
        details: JSON.stringify({ assetId, title: dto.title }),
      },
    });

    return { success: true, data: proposal };
  }

  async vote(userId: string, proposalId: string, dto: VoteProposalDto) {
    const proposal = await this.prisma.daoProposal.findUnique({
      where: { id: proposalId },
      include: {
        snapshots: {
          where: { userId },
          select: { votingPower: true },
          take: 1,
        },
      },
    });

    if (!proposal) throw new NotFoundException('proposal-not-found');
    if (proposal.status !== $Enums.ProposalStatus.ACTIVE) {
      throw new BadRequestException('proposal-not-active');
    }

    const now = new Date();
    if (now < proposal.snapshotDate) {
      throw new BadRequestException('voting-not-open-yet');
    }
    if (now > proposal.endDate) {
      throw new BadRequestException('voting-ended');
    }

    const snapshotPower = proposal.snapshots[0]?.votingPower;
    if (!snapshotPower || new Decimal(snapshotPower).lte(0)) {
      throw new BadRequestException(
        'no-voting-power-at-snapshotDate (missing snapshot)',
      );
    }

    const created = await this.prisma.proposalVote.create({
      data: {
        proposalId,
        userId,
        isFor: dto.isFor,
        votingPower: new Decimal(snapshotPower as any),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        entity: 'DAO_PROPOSAL',
        entityId: proposalId,
        action: dto.isFor ? 'VOTE_FOR' : 'VOTE_AGAINST',
        performedBy: userId,
        details: JSON.stringify({
          votingPower: snapshotPower,
        }),
      },
    });

    return { success: true, data: created };
  }

  async executeProposal(proposalId: string, adminId: string) {
    const proposal = await this.prisma.daoProposal.findUnique({
      where: { id: proposalId },
    });
    if (!proposal) throw new NotFoundException('proposal-not-found');

    if (proposal.status !== $Enums.ProposalStatus.PASSED) {
      throw new BadRequestException('proposal-not-passed');
    }

    const updated = await this.prisma.daoProposal.update({
      where: { id: proposalId },
      data: { status: $Enums.ProposalStatus.EXECUTED },
    });

    await this.prisma.auditLog.create({
      data: {
        entity: 'DAO_PROPOSAL',
        entityId: proposalId,
        action: 'EXECUTED',
        performedBy: adminId,
        details: 'Admin marked proposal as executed (off-chain).',
      },
    });

    return { success: true, data: updated };
  }

  async processSnapshots(now = new Date()) {
    // Take snapshots for proposals where snapshotDate passed, but snapshots not created yet
    const candidates = await this.prisma.daoProposal.findMany({
      where: {
        status: $Enums.ProposalStatus.ACTIVE,
        snapshotDate: { lte: now },
        snapshots: { none: {} },
      },
      select: { id: true, assetId: true },
      take: 50,
    });

    for (const proposal of candidates) {
      const asset = await this.prisma.asset.findUnique({
        where: { id: proposal.assetId },
        select: { id: true, isActive: true, tradingStatus: true },
      });
      if (!asset) continue;

      const shouldResumeTrading =
        asset.isActive && asset.tradingStatus === $Enums.AssetTradingStatus.OPEN;

      try {
        if (shouldResumeTrading) {
          await this.prisma.asset.update({
            where: { id: asset.id },
            data: { tradingStatus: $Enums.AssetTradingStatus.PAUSED },
          });
        }

        const balances = await this.prisma.balance.findMany({
          where: {
            assetId: proposal.assetId,
            OR: [{ available: { gt: 0 } }, { locked: { gt: 0 } }],
          },
          select: { userId: true, available: true, locked: true },
          take: 20000,
        });

        if (!balances.length) {
          // still create a marker snapshot row for SYSTEM? we skip; vote will fail (no holders)
          continue;
        }

        const rows = balances.map((b) => ({
          proposalId: proposal.id,
          userId: b.userId,
          votingPower: new Decimal(b.available as any).add(
            new Decimal(b.locked as any),
          ),
        }));

        // Bulk create
        await this.prisma.daoVotingSnapshot.createMany({
          data: rows as any,
          skipDuplicates: true,
        });

        await this.prisma.auditLog.create({
          data: {
            entity: 'DAO_PROPOSAL',
            entityId: proposal.id,
            action: 'SNAPSHOT_TAKEN',
            performedBy: 'SYSTEM',
            details: `Snapshot created for ${rows.length} holders.`,
          },
        });
      } finally {
        if (shouldResumeTrading) {
          await this.prisma.asset.update({
            where: { id: asset.id },
            data: { tradingStatus: $Enums.AssetTradingStatus.OPEN },
          });
        }
      }
    }
  }

  async finalizeProposals(now = new Date()) {
    const ended = await this.prisma.daoProposal.findMany({
      where: {
        status: $Enums.ProposalStatus.ACTIVE,
        endDate: { lte: now },
      },
      select: { id: true },
      take: 50,
    });

    for (const { id } of ended) {
      const proposal = await this.prisma.daoProposal.findUnique({
        where: { id },
        select: { asset: { select: { totalSupply: true } } },
      });
      if (!proposal) continue;

      const votes = await this.prisma.proposalVote.findMany({
        where: { proposalId: id },
        select: { isFor: true, votingPower: true },
        take: 20000,
      });

      const forPower = votes
        .filter((v) => v.isFor)
        .reduce((acc, v) => acc.add(new Decimal(v.votingPower as any)), new Decimal(0));
      const totalPower = votes.reduce(
        (acc, v) => acc.add(new Decimal(v.votingPower as any)),
        new Decimal(0),
      );

      const quorumThreshold = new Decimal(proposal.asset.totalSupply as any).times(
        new Decimal(0.2),
      );
      const passed =
        totalPower.greaterThanOrEqualTo(quorumThreshold) &&
        totalPower.gt(0) &&
        forPower.div(totalPower).greaterThan(new Decimal(0.51));

      const updated = await this.prisma.daoProposal.update({
        where: { id },
        data: {
          status: passed ? $Enums.ProposalStatus.PASSED : $Enums.ProposalStatus.REJECTED,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          entity: 'DAO_PROPOSAL',
          entityId: id,
          action: passed ? 'PASSED' : 'REJECTED',
          performedBy: 'SYSTEM',
          details: JSON.stringify({
            forPower: forPower.toString(),
            totalPower: totalPower.toString(),
            quorumThreshold: quorumThreshold.toString(),
          }),
        },
      });

      void updated;
    }
  }
}

