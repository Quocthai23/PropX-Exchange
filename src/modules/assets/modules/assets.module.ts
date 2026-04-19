import { Module } from '@nestjs/common';
import { AssetsService } from '../services/assets.service';
import { AssetsController } from '../controllers/assets.controller';
import { PrismaService } from '../../../prisma/prisma.service';
import { RolesGuard } from '../../users/dto/roles.guard';
import { BlockchainService } from '../services/blockchain.service';
import { IpfsService } from '../services/ipfs.service';
import { AdminCorporateActionsController } from '../controllers/admin-corporate-actions.controller';
import { CorporateActionService } from '../services/corporate-actions.service';

@Module({
  controllers: [AssetsController, AdminCorporateActionsController],
  providers: [
    AssetsService,
    PrismaService,
    RolesGuard,
    IpfsService,
    BlockchainService,
    CorporateActionService,
  ],
})
export class AssetsModule {}

