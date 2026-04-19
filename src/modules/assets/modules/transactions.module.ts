import { Module } from '@nestjs/common';
import { TransactionsController } from '../controllers/transactions.controller';
import { TransactionsService } from '../services/transactions.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { BlockchainService } from '../services/blockchain.service';
import { RolesGuard } from '../../users/dto/roles.guard';
import { TransactionsCron } from '../jobs/transactions.cron';

@Module({
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    PrismaService,
    BlockchainService,
    RolesGuard,
    TransactionsCron,
  ],
  exports: [TransactionsService],
})
export class TransactionsModule {}

