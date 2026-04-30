import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommissionsProcessor } from './commissions.processor';
import { CommissionsService } from './commissions.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { BalancesModule } from '../balances/balances.module';

export const COMMISSIONS_QUEUE = 'commissions';

@Module({
  imports: [
    ConfigModule,
    BalancesModule,
    BullModule.registerQueue({
      name: COMMISSIONS_QUEUE,
    }),
  ],
  providers: [CommissionsProcessor, CommissionsService, PrismaService],
  exports: [CommissionsService, BullModule],
})
export class CommissionsModule {}
