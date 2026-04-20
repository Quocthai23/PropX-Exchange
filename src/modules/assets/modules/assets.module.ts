import { Module } from '@nestjs/common';
import { AssetsService } from '../services/assets.service';
import { AssetsController } from '../controllers/assets.controller';
import { PrismaService } from '../../../prisma/prisma.service';
import { RolesGuard } from '../../users/dto/roles.guard';
import { BlockchainService } from '../services/blockchain.service';
import { IpfsService } from '../services/ipfs.service';
import { AdminCorporateActionsController } from '../controllers/admin-corporate-actions.controller';
import { CorporateActionService } from '../services/corporate-actions.service';
import { KmsService } from '../../../shared/services/kms.service';
import { RedeemService } from '../services/redeem.service';
import { DailyPriceCron } from '../jobs/daily-price.cron';

@Module({
  controllers: [AssetsController, AdminCorporateActionsController],
  providers: [
    AssetsService,
    PrismaService,
    RolesGuard,
    IpfsService,
    BlockchainService,
    CorporateActionService,
    KmsService,
    RedeemService,
    DailyPriceCron,
  ],
  exports: [BlockchainService],
})
export class AssetsModule {}
