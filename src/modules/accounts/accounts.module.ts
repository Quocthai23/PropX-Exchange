import { Module } from '@nestjs/common';
import { AccountsController } from './controllers/accounts.controller';
import { AdminAccountsController } from './controllers/admin-accounts.controller';
import { AccountsService } from './services/accounts.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RolesGuard } from '@/modules/users/dto/roles.guard';

@Module({
  controllers: [AccountsController, AdminAccountsController],
  providers: [AccountsService, PrismaService, RolesGuard],
  exports: [AccountsService],
})
export class AccountsModule {}
