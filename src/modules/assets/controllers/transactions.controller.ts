import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TransactionsService } from '../services/transactions.service';
import { DepositDto } from '../deposit.dto';
import { WithdrawDto } from '../withdraw.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../users/dto/roles.guard';
import { Roles } from '../../users/dto/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}


  @Post('deposit')
  async deposit(@CurrentUser() user: JwtPayload, @Body() dto: DepositDto) {
    return this.transactionsService.deposit(user.sub, dto);
  }


  @Post('withdraw')
  async requestWithdraw(
    @CurrentUser() user: JwtPayload,
    @Body() dto: WithdrawDto,
  ) {
    return this.transactionsService.requestWithdraw(user.sub, dto);
  }


  @Patch('admin/withdraw/:id/approve')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async approveWithdraw(
    @CurrentUser() admin: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transactionsService.approveWithdraw(admin.sub, id);
  }

  @Patch('admin/withdraw/:id/reject')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async rejectWithdraw(
    @CurrentUser() admin: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transactionsService.rejectWithdraw(admin.sub, id);
  }
}

