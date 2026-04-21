import { BadRequestException, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../prisma/prisma.service';
import { BlockchainService } from '../../assets/services/blockchain.service';
import { DepositDto } from '../dto/deposit.dto';
import { WithdrawDto } from '../dto/withdraw.dto';
import { TransferDto } from '../dto/transfer.dto';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
  ) {}

  private async ensureCashBalance(
    userId: string,
    prismaClient: Pick<PrismaService, 'balance'> = this.prisma,
  ) {
    const existing = await prismaClient.balance.findFirst({
      where: { userId, assetId: null },
    });

    if (existing) {
      return existing;
    }

    return prismaClient.balance.create({
      data: { userId, assetId: null },
    });
  }

  async deposit(userId: string, dto: DepositDto) {
    const amount = new Decimal(dto.amount);

    const validOnChain = await this.blockchainService.verifyDeposit(
      dto.txHash,
      amount,
      dto.walletAddress,
    );

    if (!validOnChain) {
      throw new BadRequestException(
        'Unable to verify deposit transaction on blockchain.',
      );
    }

    const duplicated = await this.prisma.transaction.findUnique({
      where: { txHash: dto.txHash },
    });

    if (duplicated) {
      throw new BadRequestException(
        'This transaction hash has already been used.',
      );
    }

    return this.prisma.$transaction(async (prismaTx) => {
      await this.ensureCashBalance(userId, prismaTx);

      return prismaTx.transaction.create({
        data: {
          userId,
          type: 'DEPOSIT',
          amount,
          status: 'PENDING',
          txHash: dto.txHash,
        },
      });
    });
  }

  async requestWithdraw(userId: string, dto: WithdrawDto) {
    const amount = new Decimal(dto.amount);

    await this.ensureCashBalance(userId);

    return this.prisma.$transaction(async (prismaTx) => {
      const balance = await prismaTx.balance.findFirst({
        where: { userId, assetId: null },
      });

      if (
        !balance ||
        new Decimal(balance.available.toString()).lessThan(amount)
      ) {
        throw new BadRequestException(
          'Insufficient available balance for withdrawal.',
        );
      }

      await prismaTx.balance.update({
        where: { id: balance.id },
        data: {
          available: { decrement: amount },
          locked: { increment: amount },
        },
      });

      return prismaTx.transaction.create({
        data: {
          userId,
          type: 'WITHDRAW',
          amount,
          status: 'PENDING',
        },
      });
    });
  }

  async approveWithdraw(adminId: string, transactionId: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!tx || tx.type !== 'WITHDRAW' || tx.status !== 'PENDING') {
      throw new BadRequestException(
        'Withdrawal transaction does not exist or has already been processed.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: tx.userId },
    });

    if (!user) {
      throw new BadRequestException(
        'User not found for this withdrawal transaction.',
      );
    }

    const gasPrice = await this.blockchainService.getCurrentGasPrice();

    const txHash = await this.blockchainService.executeWithdrawal(
      user.walletAddress,
      new Decimal(tx.amount.toString()),
    );

    await this.prisma.$transaction(async (prismaTx) => {
      await prismaTx.transaction.update({
        where: { id: tx.id },
        data: {
          txHash,
          gasPrice,
        },
      });

      await prismaTx.auditLog.create({
        data: {
          entity: 'WITHDRAWAL',
          entityId: tx.id,
          action: 'APPROVED',
          performedBy: adminId,
          details: `Admin approved withdrawal of ${tx.amount.toString()} USDT. TxHash: ${txHash}. Gas Price: ${gasPrice.toString()} wei`,
        },
      });
    });

    return {
      message:
        'Withdrawal approved. The system is waiting for blockchain confirmation.',
    };
  }

  async rejectWithdraw(adminId: string, transactionId: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!tx || tx.type !== 'WITHDRAW' || tx.status !== 'PENDING') {
      throw new BadRequestException(
        'Withdrawal transaction does not exist or has already been processed.',
      );
    }

    await this.prisma.$transaction(async (prismaTx) => {
      await prismaTx.transaction.update({
        where: { id: tx.id },
        data: { status: 'FAILED' },
      });

      await prismaTx.balance.updateMany({
        where: { userId: tx.userId, assetId: null },
        data: {
          available: { increment: tx.amount },
          locked: { decrement: tx.amount },
        },
      });

      await prismaTx.auditLog.create({
        data: {
          entity: 'WITHDRAWAL',
          entityId: tx.id,
          action: 'REJECTED',
          performedBy: adminId,
          details: `Admin rejected withdrawal of ${tx.amount.toString()} USDT.`,
        },
      });
    });

    return { message: 'Withdrawal request rejected.' };
  }

  async transferByEmail(senderId: string, dto: TransferDto) {
    const amount = new Decimal(dto.amount);

    const receiver = await this.prisma.user.findUnique({
      where: { email: dto.recipientEmail },
      select: { id: true, email: true },
    });

    if (!receiver) {
      throw new BadRequestException('Recipient email is not registered.');
    }

    if (receiver.id === senderId) {
      throw new BadRequestException('You cannot transfer to your own account.');
    }

    await this.ensureCashBalance(senderId);
    await this.ensureCashBalance(receiver.id);

    return this.prisma.$transaction(async (prismaTx) => {
      const senderBalance = await prismaTx.balance.findFirst({
        where: { userId: senderId, assetId: null },
      });

      if (
        !senderBalance ||
        new Decimal(senderBalance.available.toString()).lessThan(amount)
      ) {
        throw new BadRequestException(
          'Insufficient available balance for transfer.',
        );
      }

      const receiverBalance = await prismaTx.balance.findFirst({
        where: { userId: receiver.id, assetId: null },
      });

      if (!receiverBalance) {
        throw new BadRequestException('Recipient cash balance is unavailable.');
      }

      await prismaTx.balance.update({
        where: { id: senderBalance.id },
        data: {
          available: { decrement: amount },
        },
      });

      await prismaTx.balance.update({
        where: { id: receiverBalance.id },
        data: {
          available: { increment: amount },
        },
      });

      const senderTx = await prismaTx.transaction.create({
        data: {
          userId: senderId,
          type: 'TRANSFER_OUT',
          amount,
          status: 'COMPLETED',
        },
      });

      const receiverTx = await prismaTx.transaction.create({
        data: {
          userId: receiver.id,
          type: 'TRANSFER_IN',
          amount,
          status: 'COMPLETED',
        },
      });

      await prismaTx.auditLog.create({
        data: {
          entity: 'TRANSFER',
          entityId: senderTx.id,
          action: 'COMPLETED',
          performedBy: senderId,
          details: `Transfer ${amount.toString()} USDT to ${receiver.email}. SenderTx: ${senderTx.id}. ReceiverTx: ${receiverTx.id}`,
        },
      });

      return {
        message: 'Transfer completed successfully.',
        amount: amount.toString(),
        recipientEmail: receiver.email,
        senderTransactionId: senderTx.id,
        recipientTransactionId: receiverTx.id,
      };
    });
  }
}
