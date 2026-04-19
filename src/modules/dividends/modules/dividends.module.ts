import { Module } from '@nestjs/common';
import { DividendsService } from '../services/dividends.service';
import { AdminDividendsController } from '../controllers/admin-dividends.controller';
import { DividendsController } from '../controllers/dividends.controller';
import { DividendSnapshotCron } from '../jobs/dividend-snapshot.cron';
import { PrismaService } from '../../../prisma/prisma.service';
import { RolesGuard } from '../../users/dto/roles.guard';

@Module({
  controllers: [AdminDividendsController, DividendsController],
  providers: [
    DividendsService,
    PrismaService,
    RolesGuard,
    DividendSnapshotCron,
  ],
})
export class DividendsModule {}
