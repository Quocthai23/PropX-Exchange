import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccountsService } from '../services/accounts.service';
// TODO: Import JwtAuthGuard từ auth module
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
// import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin - User')
@Controller('admin/accounts')
@ApiBearerAuth('accessToken')
// @UseGuards(JwtAuthGuard, AdminGuard) // Bỏ comment khi ráp Auth Guard
export class AdminAccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get(':id/info')
  @ApiOperation({
    summary: 'Get account info',
    description: 'Get detailed account info for an account (DB & Redis)',
  })
  async getInfo(@Param('id') id: string) {
    return this.accountsService.getAdminAccountInfo(id);
  }
}
