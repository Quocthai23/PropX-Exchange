import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentController } from './controllers/payment.controller';
import { AdminPaymentController } from './controllers/admin-payment.controller';
import { PaymentService } from './services/payment.service';

@Module({
  controllers: [PaymentController, AdminPaymentController],
  providers: [PaymentService, PrismaService],
})
export class PaymentModule {}
