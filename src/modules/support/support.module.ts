import { Module } from '@nestjs/common';
import { SupportController } from './controllers/support.controller';
import { AdminSupportController } from './controllers/admin-support.controller';
import { SupportService } from './services/support.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RolesGuard } from '../users/dto/roles.guard';

@Module({
  controllers: [SupportController, AdminSupportController],
  providers: [SupportService, PrismaService, RolesGuard],
  exports: [SupportService],
})
export class SupportModule {}
