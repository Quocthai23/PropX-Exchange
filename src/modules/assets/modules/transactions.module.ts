import { Module } from '@nestjs/common';
import { TransactionsController } from '../controllers/transactions.controller';
import { TransactionsService } from '../services/transactions.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { BlockchainService } from '../services/blockchain.service';
import { GasSpikeService } from '../services/gas-spike.service';
import { RolesGuard } from '../../users/dto/roles.guard';
import { TransactionsCron } from '../jobs/transactions.cron';
import { KmsService } from '../../../shared/services/kms.service';

@Module({
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    PrismaService,
    BlockchainService,
    GasSpikeService,
    RolesGuard,
    TransactionsCron,
    KmsService,
  ],
  exports: [TransactionsService, GasSpikeService],
})
export class TransactionsModule {}
