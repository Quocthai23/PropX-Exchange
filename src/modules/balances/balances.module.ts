import { Module } from '@nestjs/common';
import { BalancesService } from './services/balances.service';
import { PrismaService } from '@/prisma/prisma.service';

@Module({
  providers: [BalancesService, PrismaService],
  exports: [BalancesService],
})
export class BalancesModule {}
