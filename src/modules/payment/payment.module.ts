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
import { EncryptionService } from '../auth/services/encryption.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'transaction-processing',
    }),
    BalancesModule,
  ],
  controllers: [PaymentController, AdminPaymentController],
  providers: [
    PaymentService,
    PaymentLedgerService,
    PaymentTransactionHistoryService,
    EncryptionService,
    PrismaService,
    RolesGuard,
  ],
})
export class PaymentModule {}
