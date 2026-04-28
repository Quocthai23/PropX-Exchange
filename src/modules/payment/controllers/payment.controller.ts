import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from '../services/payment.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  DepositDemoDto,
  CreateWalletDto,
  WithdrawV2Dto,
  TransferV2Dto,
  GetTransactionHistoryDto,
} from '../dto/payment.dto';

@ApiTags('Payment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('deposit-demo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deposit (demo account)' })
  depositDemo(@Body() dto: DepositDemoDto) {
    return this.paymentService.depositDemo(dto);
  }

  @Post('create-wallet')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or Get User Wallet' })
  createWallet(@Body() dto: CreateWalletDto) {
    return this.paymentService.createWallet(dto);
  }

  @Post('v2/withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create Withdrawal Request V2' })
  withdrawV2(@Body() dto: WithdrawV2Dto) {
    // TODO: Check Challenge ID verification status before processing
    return this.paymentService.processWithdrawal(dto);
  }

  @Post('v2/transfer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer Funds V2' })
  transferV2(@Body() dto: TransferV2Dto) {
    // TODO: Check Challenge ID verification status before processing
    return this.paymentService.processTransfer(dto);
  }

  @Get('history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Transaction Histories' })
  getHistory(@Query() query: GetTransactionHistoryDto) {
    const result = this.paymentService.getHistory(query);
    return result;
  }
}
