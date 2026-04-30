import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { NewsService } from './services/news.service';
import { NewsController } from './controllers/news.controller';
import { ExternalNewsAggregationService } from './services/external-news-aggregation.service';

import { BullModule } from '@nestjs/bullmq';
import { NewsSyncProcessor } from './jobs/news-sync.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'news-sync',
    }),
  ],
  controllers: [NewsController],
  providers: [
    NewsService,
    ExternalNewsAggregationService,
    PrismaService,
    NewsSyncProcessor,
  ],
})
export class NewsModule {}
