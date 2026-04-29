import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/users/dto/roles.guard';
import { Roles } from '@/modules/users/dto/roles.decorator';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import type { JwtPayload } from '@/modules/auth/types/jwt-payload.type';
import { OnboardingService } from '../services/onboarding.service';
import { AdminUpdateOnboardingStatusDto } from '../dto/admin-update-onboarding-status.dto';
import { TokenizeOnboardingDto } from '../dto/tokenize-onboarding.dto';

@ApiTags('Admin - Onboarding')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/onboarding')
export class AdminOnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get()
  @ApiOperation({ summary: 'List onboarding requests (admin)' })
  async list() {
    return this.onboardingService.listAdminRequests();
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update onboarding request status (admin)' })
  async updateStatus(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('id') id: string,
    @Body() dto: AdminUpdateOnboardingStatusDto,
  ) {
    return this.onboardingService.updateStatus(id, user?.sub ?? 'SYSTEM', dto);
  }

  @Post(':id/tokenize')
  @ApiOperation({ summary: 'Tokenize approved onboarding request (admin)' })
  async tokenize(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('id') id: string,
    @Body() dto: TokenizeOnboardingDto,
  ) {
    return this.onboardingService.tokenize(id, user?.sub ?? 'SYSTEM', dto);
  }
}

