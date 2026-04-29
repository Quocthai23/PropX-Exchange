import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssetsService } from '../services/assets.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CreateAssetDto } from '../dto/create-asset.dto';
import { UpdateAssetDto } from '../dto/asset.dto';
import { RolesGuard } from '@/modules/users/dto/roles.guard';
import { Roles } from '@/modules/users/dto/roles.decorator';

@ApiTags('Admin - Assets')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/assets')
export class AdminAssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get list of assets with full asset configuration fields',
  })
  async getAdminAssets() {
    const data = await this.assetsService.getAdminAssets();
    return { data, total: data.length };
  }

  @Post('config/reload')
  @ApiOperation({ summary: 'Publish assets reload event to trading engine' })
  async reloadConfig() {
    return await this.assetsService.reloadAssetConfig();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new asset (Pending approval)' })
  async createAsset(@Body() dto: CreateAssetDto) {
    // Tạo tài sản mới, mặc định trạng thái sẽ là inactive/pending
    return await this.assetsService.createAsset(dto);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve and activate an asset for trading' })
  async approveAsset(@Param('id') id: string) {
    // Duyệt tài sản để public ra thị trường
    return await this.assetsService.approveAsset(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Upsert asset configuration' })
  async updateAsset(@Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return await this.assetsService.updateAsset(id, dto);
  }
}
