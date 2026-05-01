import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from '../services/payment.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../users/dto/roles.guard';
import { Roles } from '../../users/dto/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import {
  GetTransactionHistoryDto,
  AdminUpdateWithdrawStatusDto,
  AdminSweepFundsDto,
} from '../dto/payment.dto';

@ApiTags('Admin - Payment')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminPaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('transaction')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin Get Transaction Histories' })
  getTransactions(@Query() query: GetTransactionHistoryDto) {
    return this.paymentService.adminGetHistory(query);
  }

  @Patch('withdraw/:transactionId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin Update Withdraw Transaction Status' })
  updateWithdrawStatus(
    @Param('transactionId') transactionId: string,
    @Body() dto: AdminUpdateWithdrawStatusDto,
  ) {
    return this.paymentService.adminUpdateWithdrawStatus(transactionId, dto);
  }

  @Post('sweep-funds')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sweep Funds (Aggregate funds from user wallets to master wallet)',
  })
  sweepFunds(@CurrentUser() user: JwtPayload, @Body() dto: AdminSweepFundsDto) {
    return this.paymentService.adminSweepFunds(user.sub, dto);
  }
}
