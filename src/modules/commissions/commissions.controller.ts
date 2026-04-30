import { Controller, Get, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CommissionsService } from './commissions.service';
import { UpdateCommissionConfigDto, GetRewardsQueryDto } from './dto/commission.dto';
import { CommissionEvent } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../users/dto/roles.guard';
import { Roles } from '../users/dto/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Commissions')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('commissions')
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Get('config')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all commission configs (Admin Only)' })
  @ApiResponse({ status: 200, description: 'Return all commission configs.' })
  async getConfigs() {
    return this.commissionsService.getConfigs();
  }

  @Put('config/:eventType')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a commission config (Admin Only)' })
  @ApiParam({ name: 'eventType', enum: CommissionEvent })
  @ApiResponse({ status: 200, description: 'Return the updated commission config.' })
  async updateConfig(
    @Param('eventType') eventType: CommissionEvent,
    @Body() dto: UpdateCommissionConfigDto,
  ) {
    return this.commissionsService.updateConfig(eventType, dto);
  }

  @Get('rewards')
  @ApiOperation({ summary: 'Get current user commission rewards' })
  @ApiResponse({ status: 200, description: 'Return user rewards with pagination.' })
  async getUserRewards(
    @CurrentUser('id') userId: string,
    @Query() query: GetRewardsQueryDto,
  ) {
    return this.commissionsService.getUserRewards(userId, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get current user commission stats' })
  @ApiResponse({ status: 200, description: 'Return user commission stats.' })
  async getUserStats(@CurrentUser('id') userId: string) {
    return this.commissionsService.getUserStats(userId);
  }
}
