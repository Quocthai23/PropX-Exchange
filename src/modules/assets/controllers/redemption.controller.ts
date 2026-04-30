import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import type { JwtPayload } from '@/modules/auth/types/jwt-payload.type';
import { RolesGuard } from '@/modules/users/dto/roles.guard';
import { Roles } from '@/modules/users/dto/roles.decorator';
import { RedeemService } from '../services/redeem.service';
import { AdminUpdateRedemptionDto } from '../dto/redeem-asset.dto';

@Controller()
export class RedemptionController {
  constructor(private readonly redeemService: RedeemService) {}

  @ApiTags('Asset Redemption')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('assets/:id/redeem')
  @ApiOperation({
    summary: 'Request full asset redemption (requires 100% supply)',
  })
  async requestRedeem(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('id') assetId: string,
  ) {
    return this.redeemService.requestRedeem(user?.sub ?? 'SYSTEM', assetId);
  }

  @ApiTags('Admin - Asset Redemption')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/redemptions')
  @ApiOperation({ summary: 'List redemption requests (admin)' })
  async list() {
    return this.redeemService.listRedemptionRequests();
  }

  @ApiTags('Admin - Asset Redemption')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/redemptions/:id')
  @ApiOperation({ summary: 'Update redemption request status (admin)' })
  async update(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('id') redemptionId: string,
    @Body() dto: AdminUpdateRedemptionDto,
  ) {
    return this.redeemService.updateRedemptionStatus(
      redemptionId,
      user?.sub ?? 'SYSTEM',
      dto,
    );
  }

  @ApiTags('Admin - Asset Redemption')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin/redemptions/:id/complete')
  @ApiOperation({ summary: 'Complete redemption: burn tokens and close asset' })
  async complete(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('id') redemptionId: string,
  ) {
    return this.redeemService.completeRedemption(
      redemptionId,
      user?.sub ?? 'SYSTEM',
    );
  }
}
