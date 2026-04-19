import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainService } from './blockchain.service';
import { CreateAssetDto } from './dto/create-asset.dto';

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

      const { contractAddress, txHash } = await this.blockchainService.tokenizeAsset({
        name: asset.name,
        symbol: asset.symbol,
        totalSupply: BigInt(asset.totalSupply.toString()),
      });


      return await this.prisma.asset.update({
        where: { id: asset.id },
        data: { contractAddress, txHash, isActive: true },
      });
    } catch (error) {
      this.logger.error(`Failed to tokenize asset ${asset.symbol}`, error);

      await this.prisma.asset.delete({ where: { id: asset.id } });
      throw new InternalServerErrorException('Error while tokenizing asset on blockchain: ' + error.message);
    }
  }

  async findAll() {
    return this.prisma.asset.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
