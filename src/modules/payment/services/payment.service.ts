import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  DepositDemoDto,
  CreateWalletDto,
  WithdrawV2Dto,
  TransferV2Dto,
  GetTransactionHistoryDto,
  AdminUpdateWithdrawStatusDto,
  AdminSweepFundsDto,
} from '../dto/payment.dto';

@Injectable()
export class PaymentService {
  constructor(private readonly prisma: PrismaService) {}

  depositDemo(dto: DepositDemoDto) {
    void dto; // Temporary bypass unused variable
    return {
      accountId: dto.accountId,
      amount: '1000',
      availableBalance: '1000',
      lockedBalance: '0',
    };
  }

  createWallet(dto: CreateWalletDto) {
    void dto;
    return {
      wallet: {
        id: 'w_123',
        accountId: dto.accountId,
        chainId: dto.chainId,
        type: dto.type,
        address: '0xMockWalletAddress...',
        createdAt: new Date().toISOString(),
      },
    };
  }

  processWithdrawal(dto: WithdrawV2Dto) {
    void dto;
    return { success: true, transactionId: 'tx_12345' };
  }

  processTransfer(dto: TransferV2Dto) {
    void dto;
    return { success: true };
  }

  getHistory(query: GetTransactionHistoryDto) {
    void query;
    return { data: [], total: 0 };
  }

  adminUpdateWithdrawStatus(
    transactionId: string,
    dto: AdminUpdateWithdrawStatusDto,
  ) {
    void transactionId;
    void dto;
    return { success: true };
  }

  adminSweepFunds(dto: AdminSweepFundsDto) {
    return {
      chainId: dto.chainId,
      destinationWallet: dto.destinationWallet,
      totalSwept: '0',
      lastSweptTransactionId: 'tx_sweep_mock_123',
    };
  }
}
