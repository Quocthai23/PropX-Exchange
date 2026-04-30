import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AssetsModule } from '@/modules/assets/assets.module';
import { BullModule } from '@nestjs/bullmq';
import { OnboardingController } from './controllers/onboarding.controller';
import { AdminOnboardingController } from './controllers/admin-onboarding.controller';
import { OnboardingService } from './services/onboarding.service';

@Module({
  imports: [
    AssetsModule,
    BullModule.registerQueue({
      name: 'asset-blockchain',
    }),
  ],
  controllers: [OnboardingController, AdminOnboardingController],
  providers: [OnboardingService, PrismaService],
})
export class OnboardingModule {}
