import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

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
    const proposal = await this.prisma.multiSigProposal.create({
      data: {
        type: input.type,
        payload: input.payload as any,
        status: 'PENDING',
        requiredApprovals: this.requiredApprovals,
        approvals: [proposerId],
      },
    });

    return {
      proposalId: proposal.id,
      status: proposal.status as 'PENDING' | 'EXECUTED',
      requiredApprovals: proposal.requiredApprovals,
      approvals: proposal.approvals as string[],
      type: proposal.type,
      payload: proposal.payload as Record<string, unknown>,
    };
  }

  async approve(
    proposalId: string,
    adminId: string,
  ): Promise<ProposalSnapshot> {
    const proposal = await this.prisma.multiSigProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new NotFoundException('MultiSig proposal not found');
    }

    if (proposal.status === 'EXECUTED') {
      throw new BadRequestException('Proposal already executed');
    }

    const approvals = proposal.approvals as string[];
    if (approvals.includes(adminId)) {
      throw new BadRequestException('Admin already approved this proposal');
    }

    const nextApprovals = [...approvals, adminId];
    const executed = nextApprovals.length >= proposal.requiredApprovals;
    const nextStatus = executed ? 'EXECUTED' : 'PENDING';

    const updated = await this.prisma.multiSigProposal.update({
      where: { id: proposalId },
      data: {
        approvals: nextApprovals,
        status: nextStatus,
      },
    });

    return {
      proposalId: updated.id,
      status: updated.status as 'PENDING' | 'EXECUTED',
      requiredApprovals: updated.requiredApprovals,
      approvals: updated.approvals as string[],
      type: updated.type,
      payload: updated.payload as Record<string, unknown>,
    };
  }

  async getSnapshot(proposalId: string): Promise<ProposalSnapshot> {
    const proposal = await this.prisma.multiSigProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new NotFoundException('MultiSig proposal not found');
    }

    return {
      proposalId: proposal.id,
      status: proposal.status as 'PENDING' | 'EXECUTED',
      requiredApprovals: proposal.requiredApprovals,
      approvals: proposal.approvals as string[],
      type: proposal.type,
      payload: proposal.payload as Record<string, unknown>,
    };
  }
}
