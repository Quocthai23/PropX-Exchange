import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { BlockchainService } from './blockchain.service';
import { CreateAssetDto } from '../dto/create-asset.dto';

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
  ) {}

  async create(dto: CreateAssetDto) {
    const asset = await this.prisma.asset.create({
      data: {
        symbol: dto.symbol,
        name: dto.name,
        description: dto.description,
        logo: dto.logo,
        categoryId: dto.categoryId,
        totalSupply: dto.totalSupply,
        tokenPrice: dto.tokenPrice,
        expectedApy: dto.expectedApy,
        isHot: dto.isHot ?? false,
        isActive: false,
      },
    });

    try {
      const txHash = await this.blockchainService.sendTokenizeTx({
        name: asset.name,
        symbol: asset.symbol,
        totalSupply: BigInt(asset.totalSupply.toString()),
      });
      await this.prisma.asset.update({
        where: { id: asset.id },
        data: { txHash },
      });

      const contractAddress =
        await this.blockchainService.waitForTokenizeReceipt(txHash);

      return await this.prisma.asset.update({
        where: { id: asset.id },
        data: { contractAddress, txHash, isActive: true },
      });
    } catch (error) {
      this.logger.error(`Failed to tokenize asset ${asset.symbol}`, error);

      try {
        const currentAsset = await this.prisma.asset.findUnique({
          where: { id: asset.id },
        });
        if (!currentAsset?.txHash) {
          await this.prisma.asset.delete({ where: { id: asset.id } });
        }
      } catch (dbError) {
        this.logger.error(
          `Failed to clean up asset ${asset.id} after error`,
          dbError,
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        'Error while tokenizing asset on blockchain: ' + errorMessage,
      );
    }
  }

  async findAll() {
    return this.prisma.asset.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }
  @Cron(CronExpression.EVERY_MINUTE)
  async reconcilePendingAssets() {
    const pendingAssets = await this.prisma.asset.findMany({
      where: {
        isActive: false,
        txHash: { not: null },
        contractAddress: null,
      },
    });

    for (const asset of pendingAssets) {
      try {
        if (!asset.txHash) {
          this.logger.warn(
            `Skipping asset ${asset.symbol} (${asset.id}) because txHash is missing.`,
          );
          continue;
        }

        this.logger.log(
          `Reconciling pending asset: ${asset.symbol} with txHash: ${asset.txHash}`,
        );
        const contractAddress =
          await this.blockchainService.waitForTokenizeReceipt(asset.txHash);

        await this.prisma.asset.update({
          where: { id: asset.id },
          data: { contractAddress, isActive: true },
        });
        this.logger.log(`Successfully reconciled asset: ${asset.symbol}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to reconcile asset ${asset.symbol}: ${errorMessage}`,
        );
      }
    }
  }
}
