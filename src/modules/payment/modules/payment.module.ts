import { Module } from '@nestjs/common';
import { TransactionsController } from '../controllers/transactions.controller';
import { PaymentController } from '../controllers/payment.controller';
import { TransactionsService } from '../services/transactions.service';
import { PaymentService } from '../services/payment.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { BlockchainService } from '../../assets/services/blockchain.service';
import { GasSpikeService } from '../services/gas-spike.service';
import { RolesGuard } from '../../users/dto/roles.guard';
import { TransactionsCron } from '../jobs/transactions.cron';
import { KmsService } from '../../../shared/services/kms.service';

@Module({
  controllers: [TransactionsController, PaymentController],
  providers: [
    TransactionsService,
    PaymentService,
    PrismaService,
    BlockchainService,
    GasSpikeService,
    RolesGuard,
    TransactionsCron,
    KmsService,
  ],
  exports: [TransactionsService, PaymentService, GasSpikeService],
})
export class PaymentModule {}
