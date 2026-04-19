import { Module } from '@nestjs/common';
import { SupportService } from '../services/support.service';
import { SupportController } from '../controllers/support.controller';
import { PrismaService } from '../../../prisma/prisma.service';
import { RolesGuard } from '../../users/dto/roles.guard';

@Module({
  controllers: [SupportController],
  providers: [SupportService, PrismaService, RolesGuard],
})
export class SupportModule {}
