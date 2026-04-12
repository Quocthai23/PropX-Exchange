import { Module } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { RolesGuard } from '../users/dto/roles.guard';
import { BlockchainService } from './blockchain.service';
import { IpfsService } from './ipfs.service';

@Module({
  controllers: [AssetsController],
  providers: [
    AssetsService,
    PrismaService,
    RolesGuard,
    IpfsService,
    BlockchainService,
  ],
})
export class AssetsModule {}
