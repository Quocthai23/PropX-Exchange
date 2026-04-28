import { Controller, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccountsService } from '../services/accounts.service';
import { UpdateAccountDto } from '../dto/accounts.dto';
// TODO: Import JwtAuthGuard và CurrentUser decorator từ auth module
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
// import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Accounts')
@Controller('accounts')
@ApiBearerAuth('accessToken')
// @UseGuards(JwtAuthGuard) // Bỏ comment khi ráp Auth Guard
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
    // @CurrentUser() user: any
  ) {
    const userId = 'mock-user-id'; // Thay bằng user.sub
    return this.accountsService.getBalance(userId, accountId);
  }

  @Get()
  @ApiOperation({
    summary: 'List user accounts',
    description: 'Get all trading accounts of current user',
  })
  async getAccounts(
    @Query('accountTypeId') accountTypeId?: string,
    // @CurrentUser() user: any
  ) {
    const userId = 'mock-user-id'; // Thay bằng user.sub
    return this.accountsService.getAccounts(userId, accountTypeId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update account name, avatar, leverage, and status',
  })
  async updateAccount(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
    // @CurrentUser() user: any
  ) {
    const userId = 'mock-user-id'; // Thay bằng user.sub
    return this.accountsService.updateAccount(userId, id, dto);
  }
}
