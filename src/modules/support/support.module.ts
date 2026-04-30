import { Module } from '@nestjs/common';
import { SupportController } from './controllers/support.controller';
import { AdminSupportController } from './controllers/admin-support.controller';
import { SupportService } from './services/support.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RolesGuard } from '../users/dto/roles.guard';
import { SupportGateway } from './gateways/support.gateway';

@Module({
  controllers: [SupportController, AdminSupportController],
  providers: [SupportService, PrismaService, RolesGuard, SupportGateway],
  exports: [SupportService, SupportGateway],
})
export class SupportModule {}
