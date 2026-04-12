import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { DepositDto } from './deposit.dto';
import { WithdrawDto } from './withdraw.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../users/dto/roles.guard';
import { Roles } from '../users/dto/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  // API: User nạp tiền (kèm hash để verify)
  @Post('deposit')
  async deposit(@CurrentUser() user: JwtPayload, @Body() dto: DepositDto) {
    return this.transactionsService.deposit(user.sub, dto);
  }

  // API: User yêu cầu rút tiền
  @Post('withdraw')
  async requestWithdraw(
    @CurrentUser() user: JwtPayload,
    @Body() dto: WithdrawDto,
  ) {
    return this.transactionsService.requestWithdraw(user.sub, dto);
  }

  // API: Admin duyệt lệnh rút tiền
  @Patch('admin/withdraw/:id/approve')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async approveWithdraw(@Param('id', ParseUUIDPipe) id: string) {
    return this.transactionsService.approveWithdraw(id);
  }

  @Patch('admin/withdraw/:id/reject')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async rejectWithdraw(@Param('id', ParseUUIDPipe) id: string) {
    return this.transactionsService.rejectWithdraw(id);
  }
}
