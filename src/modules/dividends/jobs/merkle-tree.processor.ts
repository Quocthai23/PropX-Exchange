import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ethers } from 'ethers';

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

@Processor('merkle-tree')
export class MerkleTreeProcessor extends WorkerHost {
  private readonly logger = new Logger(MerkleTreeProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ distributionId: string }>) {
    const { distributionId } = job.data;
    this.logger.log(
      `Building Merkle Tree for distribution ${distributionId}...`,
    );

    try {
      const merkleClaims = await this.prisma.dividendClaim.findMany({
        where: { distributionId },
        orderBy: { userId: 'asc' },
        select: { userId: true, amount: true, user: { select: { walletAddress: true } } },
      });

      const merkleLeaves = merkleClaims.map((c) => {
        const wallet = c.user?.walletAddress || '0x0000000000000000000000000000000000000000';
        return hashLeaf(wallet, c.amount.toString());
      });

      const tree = buildMerkleTree(merkleLeaves);
      const merkleRoot = tree[tree.length - 1][0] ?? '';

      await this.prisma.auditLog.create({
        data: {
          entity: 'DIVIDEND_DISTRIBUTION',
          entityId: distributionId,
          action: 'MERKLE_ROOT_PUBLISHED',
          performedBy: 'SYSTEM_WORKER',
          details: JSON.stringify({
            merkleRoot,
            leafCount: merkleLeaves.length,
            generatedAt: new Date().toISOString(),
          }),
        },
      });

      this.logger.log(
        `Merkle Tree built for distribution ${distributionId}. Root: ${merkleRoot}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to build Merkle Tree for ${distributionId}`,
        error,
      );
      throw error;
    }
  }
}
