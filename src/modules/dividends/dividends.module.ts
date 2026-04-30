import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DividendsService } from './services/dividends.service';
import { AdminDividendsController } from './controllers/admin-dividends.controller';
import { DividendsController } from './controllers/dividends.controller';
import { DividendSnapshotCron } from './jobs/dividend-snapshot.cron';
import { MerkleTreeProcessor } from './jobs/merkle-tree.processor';
import { PrismaService } from '@/prisma/prisma.service';
import { RolesGuard } from '../users/dto/roles.guard';
import { BalancesModule } from '../balances/balances.module';

@Module({
  imports: [
    BalancesModule,
    BullModule.registerQueue({
      name: 'merkle-tree',
    }),
  ],
  controllers: [AdminDividendsController, DividendsController],
  providers: [
    DividendsService,
    PrismaService,
    RolesGuard,
    DividendSnapshotCron,
    MerkleTreeProcessor,
  ],
})
export class DividendsModule {}
