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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import {
  DepositDemoDto,
  CreateWalletDto,
  WithdrawV2Dto,
  TransferV2Dto,
  GetTransactionHistoryDto,
} from '../dto/payment.dto';

@ApiTags('Payment')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('deposit-demo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deposit (demo account)' })
  depositDemo(@CurrentUser() user: JwtPayload, @Body() dto: DepositDemoDto) {
    return this.paymentService.depositDemo(user.sub, dto);
  }

  @Post('create-wallet')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or Get User Wallet' })
  createWallet(@CurrentUser() user: JwtPayload, @Body() dto: CreateWalletDto) {
    return this.paymentService.createWallet(user.sub, dto);
  }

  @Post('v2/withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create Withdrawal Request V2' })
  withdrawV2(@CurrentUser() user: JwtPayload, @Body() dto: WithdrawV2Dto) {
    // TODO: Check Challenge ID verification status before processing
    return this.paymentService.processWithdrawal(user.sub, dto);
  }

  @Post('v2/transfer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer Funds V2' })
  transferV2(@CurrentUser() user: JwtPayload, @Body() dto: TransferV2Dto) {
    // TODO: Check Challenge ID verification status before processing
    return this.paymentService.processTransfer(user.sub, dto);
  }

  @Get('history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Transaction Histories' })
  getHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetTransactionHistoryDto,
  ) {
    return this.paymentService.getHistory(user.sub, query);
  }
}
