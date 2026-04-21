import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PaymentService } from '../services/payment.service';
import { GasSpikeService } from '../services/gas-spike.service';
import { DepositDto } from '../dto/deposit.dto';
import { WithdrawDto } from '../dto/withdraw.dto';
import { TransferDto } from '../dto/transfer.dto';
import { GasSpeedUpDto, GasRefundDto } from '../dto/gas-spike.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../users/dto/roles.guard';
import { Roles } from '../../users/dto/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly gasSpikeService: GasSpikeService,
  ) {}

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

  /**
   * Speed up a stuck withdrawal transaction by increasing gas price
   */
  @Post('gas/speed-up')
  async speedUpTransaction(
    @CurrentUser() user: JwtPayload,
    @Body() dto: GasSpeedUpDto,
  ) {
    return this.gasSpikeService.speedUpTransaction(dto);
  }

  /**
   * Request refund for a stuck withdrawal transaction
   */
  @Post('gas/refund')
  async requestRefund(
    @CurrentUser() user: JwtPayload,
    @Body() dto: GasRefundDto,
  ) {
    return this.gasSpikeService.processRefund({
      ...dto,
      reason: dto.reason || 'User requested refund due to stuck transaction',
    });
  }

  /**
   * Get gas spike status and recommendations for a transaction
   */
  @Get('gas/status/:id')
  async getGasStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.gasSpikeService.getGasStatus(id);
  }
}
