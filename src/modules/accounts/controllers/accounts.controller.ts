import { Controller, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccountsService } from '../services/accounts.service';
import { UpdateAccountDto } from '../dto/accounts.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';

@ApiTags('Accounts')
@Controller('accounts')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('types')
  @ApiOperation({
    summary: 'List account types',
    description: 'Get list of active account types (public endpoint)',
  })
  async getTypes() {
    return this.accountsService.getTypes();
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get account balance details' })
  async getBalance(
    @Query('accountId') accountId: string,
    @CurrentUser() user: JwtPayload
  ) {
    return this.accountsService.getBalance(user.sub, accountId);
  }

  @Get()
  @ApiOperation({
    summary: 'List user accounts',
    description: 'Get all trading accounts of current user',
  })
  async getAccounts(
    @Query('accountTypeId') accountTypeId?: string,
    @CurrentUser() user: JwtPayload
  ) {
    return this.accountsService.getAccounts(user.sub, accountTypeId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update account name, avatar, leverage, and status',
  })
  async updateAccount(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
    @CurrentUser() user: JwtPayload
  ) {
    return this.accountsService.updateAccount(user.sub, id, dto);
  }
}
