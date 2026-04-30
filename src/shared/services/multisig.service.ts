import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { randomUUID } from 'crypto';

export interface MultiSigProposalPayload {
  type: string;
  payload: Record<string, unknown>;
}

interface ProposalSnapshot {
  proposalId: string;
  status: 'PENDING' | 'EXECUTED';
  requiredApprovals: number;
  approvals: string[];
  type: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class MultiSigService {
  private readonly requiredApprovals = 3;

  constructor(private readonly prisma: PrismaService) {}

  async createProposal(
    proposerId: string,
    input: MultiSigProposalPayload,
  ): Promise<ProposalSnapshot> {
    const proposalId = randomUUID();
    const details: ProposalSnapshot = {
      proposalId,
      status: 'PENDING',
      requiredApprovals: this.requiredApprovals,
      approvals: [],
      type: input.type,
      payload: input.payload,
    };

    await this.prisma.auditLog.create({
      data: {
        entity: 'MULTISIG_PROPOSAL',
        entityId: proposalId,
        action: 'PROPOSED',
        performedBy: proposerId,
        details: JSON.stringify(details),
      },
    });

    return details;
  }

  async approve(
    proposalId: string,
    adminId: string,
  ): Promise<ProposalSnapshot> {
    const snapshot = await this.getSnapshot(proposalId);
    if (snapshot.status === 'EXECUTED') {
      throw new BadRequestException('Proposal already executed');
    }

    if (snapshot.approvals.includes(adminId)) {
      throw new BadRequestException('Admin already approved this proposal');
    }

    const nextApprovals = [...snapshot.approvals, adminId];
    const executed = nextApprovals.length >= snapshot.requiredApprovals;
    const nextSnapshot: ProposalSnapshot = {
      ...snapshot,
      approvals: nextApprovals,
      status: executed ? 'EXECUTED' : 'PENDING',
    };

    await this.prisma.auditLog.create({
      data: {
        entity: 'MULTISIG_PROPOSAL',
        entityId: proposalId,
        action: executed ? 'EXECUTED' : 'APPROVED',
        performedBy: adminId,
        details: JSON.stringify(nextSnapshot),
      },
    });

    return nextSnapshot;
  }

  async getSnapshot(proposalId: string): Promise<ProposalSnapshot> {
    const latestLog = await this.prisma.auditLog.findFirst({
      where: {
        entity: 'MULTISIG_PROPOSAL',
        entityId: proposalId,
      },
      orderBy: { createdAt: 'desc' },
      select: { details: true },
    });

    if (!latestLog?.details) {
      throw new NotFoundException('MultiSig proposal not found');
    }

    return JSON.parse(latestLog.details) as ProposalSnapshot;
  }
}
