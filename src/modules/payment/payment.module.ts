import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentController } from './controllers/payment.controller';
import { AdminPaymentController } from './controllers/admin-payment.controller';
import { PaymentService } from './services/payment.service';
import { BalancesModule } from '../balances/balances.module';
import { RolesGuard } from '../users/dto/roles.guard';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'transaction-processing',
    }),
    BalancesModule,
  ],
  controllers: [PaymentController, AdminPaymentController],
  providers: [PaymentService, PrismaService, RolesGuard],
})
export class PaymentModule {}
