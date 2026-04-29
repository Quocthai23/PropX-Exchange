import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { KycService } from '../services/kyc.service';
import { KycController } from '../controllers/kyc.controller';
import { PrismaService } from '../../../prisma/prisma.service';
import { RolesGuard } from '../../users/dto/roles.guard';
import { BlockchainService } from '../services/blockchain.service';
import { KycApprovalProcessor } from '../jobs/kyc-approval.processor';
import { KmsService } from '../../../shared/services/kms.service';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'kyc-approval',
    }),
    NotificationsModule,
  ],
  controllers: [KycController],
  providers: [
    KycService,
    PrismaService,
    RolesGuard,
    BlockchainService,
    KycApprovalProcessor,
    KmsService,
  ],
})
export class KycModule {}
