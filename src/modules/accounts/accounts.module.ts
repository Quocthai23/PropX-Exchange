import { Module } from '@nestjs/common';
import { AccountsController } from './controllers/accounts.controller';
import { AdminAccountsController } from './controllers/admin-accounts.controller';
import { AccountsService } from './services/accounts.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [AccountsController, AdminAccountsController],
  providers: [AccountsService, PrismaService],
  exports: [AccountsService],
})
export class AccountsModule {}
