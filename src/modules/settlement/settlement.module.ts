import { Module } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetsModule } from '../assets/modules/assets.module';

@Module({
  imports: [AssetsModule],
  providers: [SettlementService, PrismaService],
})
export class SettlementModule {}
