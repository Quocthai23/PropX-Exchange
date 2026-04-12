import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { AssetStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { CreateAssetDto } from './dto/create-asset.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainService } from './blockchain.service';
import { IpfsService } from './ipfs.service';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ipfsService: IpfsService,
    private readonly blockchainService: BlockchainService,
  ) {}

  private static readonly TOKEN_DECIMALS = 18;

  private parseImageUris(images: Prisma.JsonValue): string[] {
    if (!Array.isArray(images)) {
      return [];
    }

    return images.filter((value): value is string => typeof value === 'string');
  }

  private ensureTokenizationPreconditions(
    status: AssetStatus,
    contractAddress: string | null,
  ): void {
    if (status !== 'LISTING') {
      throw new BadRequestException('Only LISTING assets can be tokenized.');
    }

    if (contractAddress) {
      throw new BadRequestException('Asset has already been tokenized.');
    }
  }

  private computeTotalSupply(
    totalValuation: Decimal,
    tokenPrice: Decimal,
  ): Decimal {
    if (tokenPrice.lte(0)) {
      throw new BadRequestException('tokenPrice must be greater than zero.');
    }

    const totalSupply = totalValuation.div(tokenPrice);
    if (!totalSupply.isFinite() || totalSupply.lte(0)) {
      throw new BadRequestException(
        'Invalid total supply derived from valuation/tokenPrice.',
      );
    }

    return totalSupply.toDecimalPlaces(4, Decimal.ROUND_DOWN);
  }

  private toOnChainSupply(totalSupply: Decimal): bigint {
    const scale = new Decimal(10).pow(AssetsService.TOKEN_DECIMALS);
    const raw = totalSupply.mul(scale);
    if (!raw.isInteger()) {
      throw new BadRequestException(
        'Total supply cannot be represented on-chain with configured token decimals.',
      );
    }
    return BigInt(raw.toString());
  }

  async createAsset(dto: CreateAssetDto) {
    const totalValuation = new Decimal(dto.totalValuation);
    const tokenPrice = new Decimal(dto.tokenPrice);
    const totalSupply = this.computeTotalSupply(totalValuation, tokenPrice);

    const created = await this.prisma.asset.create({
      data: {
        name: dto.name,
        symbol: dto.symbol,
        location: dto.location,
        images: dto.images,
        totalValuation: totalValuation.toFixed(4),
        tokenPrice: tokenPrice.toFixed(4),
        totalSupply: totalSupply.toFixed(4),
        apy: new Decimal(dto.apy).toFixed(2),
        status: 'LISTING',
      },
    });

    return created;
  }

  async uploadLegalDocs(
    assetId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
  ) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, images: true },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found.');
    }

    const { cid, uri } = await this.ipfsService.uploadFile(
      fileBuffer,
      fileName,
      mimeType,
    );

    const existingImages = this.parseImageUris(asset.images);
    const nextImages = [...existingImages, uri];

    await this.prisma.asset.update({
      where: { id: asset.id },
      data: { images: nextImages },
    });

    return {
      message: 'Legal document uploaded to IPFS successfully.',
      cid,
      uri,
    };
  }

  async tokenizeAsset(assetId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        name: true,
        symbol: true,
        location: true,
        images: true,
        status: true,
        contractAddress: true,
        totalSupply: true,
        totalValuation: true,
        tokenPrice: true,
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found.');
    }

    this.ensureTokenizationPreconditions(asset.status, asset.contractAddress);

    const totalSupply = new Decimal(asset.totalSupply.toString());
    const onChainSupply = this.toOnChainSupply(totalSupply);

    const metadataPayload = {
      assetId: asset.id,
      name: asset.name,
      symbol: asset.symbol,
      location: asset.location,
      totalValuation: asset.totalValuation.toString(),
      tokenPrice: asset.tokenPrice.toString(),
      totalSupply: asset.totalSupply.toString(),
      images: this.parseImageUris(asset.images),
      timestamp: new Date().toISOString(),
    };

    const metadata = await this.ipfsService.pinJson(metadataPayload);

    const { contractAddress, txHash } =
      await this.blockchainService.tokenizeAsset({
        name: asset.name,
        symbol: asset.symbol,
        totalSupply: onChainSupply,
      });

    try {
      const updated = await this.prisma.asset.update({
        where: { id: asset.id },
        data: {
          contractAddress,
          status: 'FUNDED',
        },
      });

      return {
        message: 'Asset tokenization completed successfully.',
        asset: updated,
        txHash,
        metadataUri: metadata.uri,
      };
    } catch {
      throw new InternalServerErrorException(
        'On-chain tokenization succeeded but DB update failed. Manual reconciliation required.',
      );
    }
  }

  async findById(assetId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });
    if (!asset) {
      throw new NotFoundException('Asset not found.');
    }
    return asset;
  }

  async listAll() {
    return this.prisma.asset.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
