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
import {
  GetTransactionHistoryDto,
  AdminUpdateWithdrawStatusDto,
  AdminSweepFundsDto,
} from '../dto/payment.dto';

@ApiTags('Admin - Payment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard) // TODO: Thêm AdminGuard
@Controller('admin')
export class AdminPaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('transaction')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin Get Transaction Histories' })
  getTransactions(@Query() query: GetTransactionHistoryDto) {
    // Admin xem lịch sử giao dịch toàn sàn (có thể bỏ trống accountId)
    return this.paymentService.getHistory(query);
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
    summary: 'Sweep Funds (Gom quỹ từ ví người dùng về ví tổng)',
  })
  sweepFunds(@Body() dto: AdminSweepFundsDto) {
    return this.paymentService.adminSweepFunds(dto);
  }
}
