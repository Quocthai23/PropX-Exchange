import { Module } from '@nestjs/common';
import { SupportController } from './controllers/support.controller';
import { AdminSupportController } from './controllers/admin-support.controller';
import { SupportService } from './services/support.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [SupportController, AdminSupportController],
  providers: [SupportService, PrismaService],
  exports: [SupportService],
})
export class SupportModule {}
