import { Injectable } from '@nestjs/common';
import { DepositDto } from '../dto/deposit.dto';
import { WithdrawDto } from '../dto/withdraw.dto';
import { PaymentService } from './payment.service';

@Injectable()
export class TransactionsService {
  constructor(private readonly paymentService: PaymentService) {}

  async deposit(userId: string, dto: DepositDto) {
    return this.paymentService.deposit(userId, dto);
  }

  async requestWithdraw(userId: string, dto: WithdrawDto) {
    return this.paymentService.requestWithdraw(userId, dto);
  }

  async approveWithdraw(adminId: string, transactionId: string) {
    return this.paymentService.approveWithdraw(adminId, transactionId);
  }

  async rejectWithdraw(adminId: string, transactionId: string) {
    return this.paymentService.rejectWithdraw(adminId, transactionId);
  }
}
