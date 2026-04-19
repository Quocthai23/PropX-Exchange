import { Controller, Post, Param, Body } from '@nestjs/common';
import { CorporateActionService } from '../services/corporate-actions.service';
// import { AdminGuard } from '../../auth/guards/admin.guard'; // Assuming you have an AdminGuard

@Controller('admin/assets/:id/corporate-actions')
// @UseGuards(AdminGuard)
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
