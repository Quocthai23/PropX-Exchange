import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommissionsProcessor } from './commissions.processor';
import { CommissionsService } from './commissions.service';
import { CommissionsController } from './commissions.controller';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { BalancesModule } from '../balances/balances.module';

@Module({
  imports: [
    ConfigModule,
    BalancesModule,
    BullModule.registerQueue({
      name: 'commissions',
    }),
  ],
  controllers: [CommissionsController],
  providers: [CommissionsProcessor, CommissionsService, PrismaService],
  exports: [CommissionsService, BullModule],
})
export class CommissionsModule {}
