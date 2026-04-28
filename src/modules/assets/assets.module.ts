import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetsService } from './services/assets.service';
import { AssetsController } from './controllers/assets.controller';
import { AdminAssetsController } from './controllers/admin-assets.controller';

@Module({
  controllers: [AssetsController, AdminAssetsController],
  providers: [AssetsService, PrismaService],
  exports: [AssetsService],
})
export class AssetsModule {}
