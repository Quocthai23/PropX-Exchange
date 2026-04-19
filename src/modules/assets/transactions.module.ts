import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainService } from './blockchain.service';
import { RolesGuard } from '../users/dto/roles.guard';

@Module({
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    PrismaService,
    BlockchainService,
    RolesGuard,
  ],
  exports: [TransactionsService],
})
export class TransactionsModule {}
