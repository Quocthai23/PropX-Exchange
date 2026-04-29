import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccountsService } from '../services/accounts.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/users/dto/roles.guard';
import { Roles } from '@/modules/users/dto/roles.decorator';

@ApiTags('Admin - User')
@Controller('admin/accounts')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
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
