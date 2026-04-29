import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CorporateActionService } from '../services/corporate-actions.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/users/dto/roles.guard';
import { Roles } from '@/modules/users/dto/roles.decorator';

@ApiTags('Admin - Assets')
@Controller('admin/assets/:id/corporate-actions')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminCorporateActionsController {
  constructor(
    private readonly corporateActionService: CorporateActionService,
  ) {}

  @Post('dividend')
  async distributeDividend(
    @Param('id') assetId: string,
    @Body('totalAmount') totalAmount: string,
  ) {
    const usersPaid = await this.corporateActionService.distributeYield(
      assetId,
      totalAmount,
    );
    return {
      success: true,
      message: `Dividend distributed to ${usersPaid} users.`,
    };
  }

  @Post('liquidate')
  async liquidateAsset(
    @Param('id') assetId: string,
    @Body('liquidationPrice') liquidationPrice: string,
  ) {
    await this.corporateActionService.liquidateAsset(assetId, liquidationPrice);
    return { success: true, message: 'Asset liquidated successfully.' };
  }
}
