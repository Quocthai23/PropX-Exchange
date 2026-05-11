import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaService } from '@/prisma/prisma.service';
import { PaymentController } from './controllers/payment.controller';
import { AdminPaymentController } from './controllers/admin-payment.controller';
import { PaymentService } from './services/payment.service';
import { PaymentLedgerService } from './services/payment-ledger.service';
import { PaymentTransactionHistoryService } from './services/payment-transaction-history.service';
import { BalancesModule } from '../balances/balances.module';
import { RolesGuard } from '../users/dto/roles.guard';

import { AssetsModule } from '../assets/assets.module';
import { TransactionProcessingProcessor } from './jobs/transaction-processing.processor';
import { DepositScannerCron } from './jobs/deposit-scanner.cron';
import { TransactionsCron } from './jobs/transactions.cron';
import { GasSpikeService } from './services/gas-spike.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'transaction-processing',
    }),
    BalancesModule,
    AssetsModule,
  ],
  controllers: [PaymentController, AdminPaymentController],
  providers: [
    PaymentService,
    PaymentLedgerService,
    PaymentTransactionHistoryService,
    PrismaService,
    RolesGuard,
    TransactionProcessingProcessor,
    DepositScannerCron,
    TransactionsCron,
    GasSpikeService,
  ],
})
export class PaymentModule {}
