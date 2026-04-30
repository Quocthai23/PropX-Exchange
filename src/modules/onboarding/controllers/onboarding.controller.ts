import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import type { JwtPayload } from '@/modules/auth/types/jwt-payload.type';
import { CreateAssetOnboardingRequestDto } from '../dto/create-asset-onboarding-request.dto';
import { OnboardingService } from '../services/onboarding.service';

@ApiTags('Asset Onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('onboarding')
  @ApiOperation({ summary: 'Create an asset onboarding request' })
  async create(
    @CurrentUser() user: JwtPayload | undefined,
    @Body() dto: CreateAssetOnboardingRequestDto,
  ) {
    return this.onboardingService.createRequest(user?.sub ?? 'SYSTEM', dto);
  }
}
