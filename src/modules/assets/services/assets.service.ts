import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAssetDto } from '../dto/create-asset.dto';
import { UpdateAssetDto } from '../dto/asset.dto';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAssetCategories() {
    const categories = await this.prisma.assetCategory.findMany({
      where: { isActive: true },
    });
    return categories.map((cat) => ({
      id: cat.id,
      code: cat.name.toUpperCase().replace(/\s+/g, '_'),
      name: cat.name,
      description: cat.description,
      marginMultiplier: '1.0',
    }));
  }

  async getPublicAssets(userId?: string) {
    const assets = await this.prisma.asset.findMany({
      where: { isActive: true },
      include: { category: true },
    });

    let favoriteAssetIds: Set<string> = new Set();
    if (userId) {
      const favorites = await this.prisma.favoriteAsset.findMany({
        where: { userId },
        select: { assetId: true },
      });
      favoriteAssetIds = new Set(favorites.map((f) => f.assetId));
    }

    return assets.map((asset) => ({
      ...asset,
      isFavorite: favoriteAssetIds.has(asset.id),
      isHot: asset.isHot ?? false,
    }));
  }

  async getAdminAssets() {
    return await this.prisma.asset.findMany({
      include: { category: true },
    });
  }

  async createAsset(dto: CreateAssetDto) {
    const asset = await this.prisma.asset.create({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: {
        ...dto,
        isActive: false,
        tradingStatus: 'OPEN',
      } as any,
    });
    return { success: true, data: asset };
  }

  async approveAsset(id: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('asset-not-found');

    await this.prisma.asset.update({
      where: { id },
      data: {
        isActive: true,
        tradingStatus: 'OPEN',
      },
    });
    return {
      success: true,
      message: 'Asset has been approved and activated successfully.',
    };
  }

  async updateAsset(id: string, dto: UpdateAssetDto) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('asset-not-found');

    await this.prisma.asset.update({
      where: { id },
      data: { ...dto } as any,
    });
    return { success: true };
  }

  async reloadAssetConfig() {
    await Promise.resolve();
    return { success: true };
  }
}
