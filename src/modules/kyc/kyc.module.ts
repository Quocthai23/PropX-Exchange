import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { RolesGuard } from '../users/dto/roles.guard';
import { BlockchainService } from './blockchain.service';
import { KycApprovalProcessor } from './jobs/kyc-approval.processor';
import { KmsService } from '../../shared/services/kms.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'kyc-approval',
    }),
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
