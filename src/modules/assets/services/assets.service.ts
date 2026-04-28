import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAssetDto } from '../dto/create-asset.dto';
import { UpdateAssetDto } from '../dto/asset.dto';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAssetCategories() {
    await Promise.resolve();
    // TODO: Fetch from actual Category table when added to schema
    return [
      {
        marginMultiplier: '1.0',
        code: 'RWA',
        name: 'Real World Assets',
        description: 'Tokenized Real Estate & Gold',
      },
      {
        marginMultiplier: '0.5',
        code: 'CRYPTO',
        name: 'Cryptocurrency',
        description: 'Digital Assets',
      },
    ];
  }

  async getPublicAssets(userId?: string) {
    await Promise.resolve(userId); // Xóa lỗi "defined but never used"
    const assets = await this.prisma.asset.findMany({
      where: { isActive: true }, // Only show active assets to public
    });

    // TODO: Fetch actual user favorites and map isFavorite boolean
    return assets.map((asset) => ({
      ...asset,
      isFavorite: false, // mock
      isHot: asset.isHot ?? false,
    }));
  }

  async getAdminAssets() {
    return await this.prisma.asset.findMany();
  }

  async createAsset(dto: CreateAssetDto) {
    const asset = await this.prisma.asset.create({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: {
        ...dto,
        isActive: false, // Mặc định tài sản mới tạo chưa được public
        tradingStatus: 'PENDING', // Đánh dấu trạng thái chờ duyệt
      } as any, // Cast to any to bypass strict schema for precise decimals
    });
    return { success: true, data: asset };
  }

  async approveAsset(id: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('asset-not-found');

    await this.prisma.asset.update({
      where: { id },
      data: {
        isActive: true, // Public tài sản ra cho user
        tradingStatus: 'OPEN', // Cho phép giao dịch (khớp lệnh)
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: { ...dto } as any, // Cast to any to bypass schema limitations for now
    });
    return { success: true };
  }

  async reloadAssetConfig() {
    await Promise.resolve();
    // TODO: Emit Redis Pub/Sub event to notify all trading-engine workers to reload configurations
    return { success: true };
  }
}
