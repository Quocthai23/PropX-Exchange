import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { DaoController } from './controllers/dao.controller';
import { DaoService } from './services/dao.service';
import { DaoGovernanceCron } from './jobs/dao-governance.cron';
import { AssetsModule } from '@/modules/assets/assets.module';

@Module({
  imports: [AssetsModule],
  controllers: [DaoController],
  providers: [DaoService, DaoGovernanceCron, PrismaService],
})
export class DaoModule {}
