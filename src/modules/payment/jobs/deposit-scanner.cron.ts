import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { BlockchainService } from '../../assets/services/blockchain.service';
import { AppConfigService } from '@/config/app-config.service';
import { PaymentLedgerService } from '../services/payment-ledger.service';

@Injectable()
export class DepositScannerCron {
  private readonly logger = new Logger(DepositScannerCron.name);
  private lastScannedBlock: number | null = null;
  private readonly blockRangeLimit = 1000; // Etherscan/RPC usually limits block range queries

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    private readonly config: AppConfigService,
    private readonly paymentLedgerService: PaymentLedgerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async scanDeposits() {
    const depositReceiver = this.config.depositReceiverAddress;
    if (!depositReceiver) {
      this.logger.warn(
        'DEPOSIT_RECEIVER_ADDRESS is not set. Skipping deposit scan.',
      );
      return;
    }

    try {
      const currentBlock = await this.blockchainService.getCurrentBlockNumber();

      if (this.lastScannedBlock === null) {
        // Initialize to scan last 100 blocks on startup
        this.lastScannedBlock = Math.max(0, currentBlock - 100);
      }

      if (this.lastScannedBlock >= currentBlock) {
        return; // No new blocks
      }

      // Ensure we don't exceed the RPC query limit
      const fromBlock = this.lastScannedBlock + 1;
      const toBlock = Math.min(currentBlock, fromBlock + this.blockRangeLimit);

      this.logger.debug(
        `Scanning deposits from block ${fromBlock} to ${toBlock}`,
      );

      const transfers = await this.blockchainService.getUsdtTransfersTo(
        depositReceiver,
        fromBlock,
        toBlock,
      );

      for (const transfer of transfers) {
        await this.processTransfer(transfer);
      }

      this.lastScannedBlock = toBlock;
    } catch (error) {
      this.logger.error('Error occurred while scanning deposits:', error);
    }
  }

  private async processTransfer(transfer: {
    txHash: string;
    from: string;
    amount: any;
  }) {
    try {
      // Find user by their registered wallet address
      const user = await this.prisma.user.findFirst({
        where: { walletAddress: transfer.from },
      });

      if (!user) {
        this.logger.warn(
          `Deposit received from unknown wallet ${transfer.from}. TxHash: ${transfer.txHash}`,
        );
        return;
      }

      // Check if transaction already exists (idempotency by txHash)
      const existingTx = await this.prisma.transaction.findFirst({
        where: { txHash: transfer.txHash, type: 'DEPOSIT' },
      });

      if (existingTx) {
        return; // Already processed
      }

      // Create a PENDING deposit transaction.
      // The TransactionsCron will later verify confirmations and finalize it.
      await this.prisma.transaction.create({
        data: {
          userId: user.id,
          type: 'DEPOSIT',
          amount: transfer.amount,
          status: 'PENDING',
          txHash: transfer.txHash,
          confirmations: 0, // Initial state
        },
      });

      this.logger.log(
        `Registered new deposit for user ${user.id} from wallet ${transfer.from}. TxHash: ${transfer.txHash}`,
      );
    } catch (error) {
      // Handle unique constraint violations gracefully in case of race conditions
      if (
        error instanceof Error &&
        error.message.includes('Unique constraint')
      ) {
        this.logger.debug(`Deposit ${transfer.txHash} already exists.`);
      } else {
        this.logger.error(
          `Failed to process deposit transfer ${transfer.txHash}:`,
          error,
        );
      }
    }
  }
}
