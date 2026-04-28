import { Module } from '@nestjs/common';
import { PositionsController } from './controllers/positions.controller';
import { AdminPositionsController } from './controllers/admin-positions.controller';
import { PositionsService } from './services/positions.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [PositionsController, AdminPositionsController],
  providers: [PositionsService, PrismaService],
  exports: [PositionsService],
})
export class PositionsModule {}
