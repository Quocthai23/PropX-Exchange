import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssetsService } from '../services/assets.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import type { JwtPayload } from '@/modules/auth/types/jwt-payload.type';
import { SubmitAssetOnboardingDto } from '../dto/asset-onboarding.dto';

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
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List all assets (public trading list)' })
  async getAssets(@CurrentUser() user: JwtPayload | undefined) {
    const data = await this.assetsService.getPublicAssets(user?.sub);
    return { data, total: data.length };
  }

  @ApiTags('Assets')
  @Post('assets/:id/onboarding/submit')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Submit legal dossier for asset onboarding' })
  async submitOnboarding(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('id') assetId: string,
    @Body() dto: SubmitAssetOnboardingDto,
  ) {
    return this.assetsService.submitOnboarding(
      user?.sub ?? 'SYSTEM',
      assetId,
      dto,
    );
  }
}
