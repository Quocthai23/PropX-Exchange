import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/accounts.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';

@ApiTags('Accounts')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'List user accounts' })
  async findAll(@CurrentUser() user: JwtPayload) {
    const accounts = await this.accountsService.findAll(user.sub);
    return { accounts };
  }

  @Get('types')
  @ApiOperation({ summary: 'List available account types' })
  async getTypes() {
    const accountTypes = await this.accountsService.getTypes();
    return { accountTypes };
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get specific account balance' })
  async getBalance(
    @CurrentUser() user: JwtPayload,
    @Query('accountId') accountId: string,
  ) {
    return this.accountsService.getBalance(user.sub, accountId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new trading account' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update account details' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountsService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an account' })
  async remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.accountsService.remove(user.sub, id);
  }
}
