import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssetsService } from '../services/assets.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import type { JwtPayload } from '@/modules/auth/types/jwt-payload.type';

@Controller()
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @ApiTags('Assets')
  @Get('asset-categories')
  @ApiOperation({ summary: 'List all asset categories' })
  async getCategories() {
    const data = await this.assetsService.getAssetCategories();
    return { data };
  }

  @ApiTags('Assets')
  @Get('assets')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List all assets (public trading list)' })
  async getAssets(@CurrentUser() user: JwtPayload | undefined) {
    const data = await this.assetsService.getPublicAssets(user?.sub);
    return { data, total: data.length };
  }
}
