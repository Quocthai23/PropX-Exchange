import { Module } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { PrismaService } from '@/prisma/prisma.service';
import { AssetsModule } from '@/modules/assets/assets.module';
import { BalancesModule } from '@/modules/balances/balances.module';

@Module({
  imports: [AssetsModule, BalancesModule],
  providers: [SettlementService, PrismaService],
})
export class SettlementModule {}
