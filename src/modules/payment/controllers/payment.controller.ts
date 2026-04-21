import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PaymentService } from '../services/payment.service';
import { DepositDto } from '../dto/deposit.dto';
import { WithdrawDto } from '../dto/withdraw.dto';
import { TransferDto } from '../dto/transfer.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../users/dto/roles.guard';
import { Roles } from '../../users/dto/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('deposit')
  async deposit(@CurrentUser() user: JwtPayload, @Body() dto: DepositDto) {
    return this.paymentService.deposit(user.sub, dto);
  }

  @Post('withdraw')
  async requestWithdraw(
    @CurrentUser() user: JwtPayload,
    @Body() dto: WithdrawDto,
  ) {
    return this.paymentService.requestWithdraw(user.sub, dto);
  }

  @Post('transfer/email')
  async transferByEmail(
    @CurrentUser() user: JwtPayload,
    @Body() dto: TransferDto,
  ) {
    return this.paymentService.transferByEmail(user.sub, dto);
  }

  @Patch('admin/withdraw/:id/approve')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async approveWithdraw(
    @CurrentUser() admin: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentService.approveWithdraw(admin.sub, id);
  }

  @Patch('admin/withdraw/:id/reject')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async rejectWithdraw(
    @CurrentUser() admin: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentService.rejectWithdraw(admin.sub, id);
  }
}
