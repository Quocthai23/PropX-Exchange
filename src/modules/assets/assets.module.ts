import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaService } from '@/prisma/prisma.service';
import { AssetsService } from './services/assets.service';
import { AssetsController } from './controllers/assets.controller';
import { AdminAssetsController } from './controllers/admin-assets.controller';
import { RolesGuard } from '@/modules/users/dto/roles.guard';
import { BlockchainService } from './services/blockchain.service';
import { IpfsService } from './services/ipfs.service';
import { AdminCorporateActionsController } from './controllers/admin-corporate-actions.controller';
import { CorporateActionService } from './services/corporate-actions.service';
import { KmsService } from '@/shared/services/kms.service';
import { RedeemService } from './services/redeem.service';
import { DailyPriceCron } from './jobs/daily-price.cron';
import { MultiSigService } from '@/shared/services/multisig.service';
import { RedemptionController } from './controllers/redemption.controller';
import { AssetBlockchainProcessor } from './jobs/asset-blockchain.processor';
import { DividendsModule } from '@/modules/dividends/dividends.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'asset-blockchain',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
      },
    }),
    DividendsModule,
  ],
  controllers: [
    AssetsController,
    AdminAssetsController,
    AdminCorporateActionsController,
    RedemptionController,
  ],
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
    AssetBlockchainProcessor,
    MultiSigService,
  ],
  exports: [AssetsService, BlockchainService, IpfsService],
})
export class AssetsModule {}
