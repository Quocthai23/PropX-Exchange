import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { NewsService } from './services/news.service';
import { NewsController } from './controllers/news.controller';
import { ExternalNewsAggregationService } from './services/external-news-aggregation.service';

@Module({
  controllers: [NewsController],
  providers: [NewsService, ExternalNewsAggregationService, PrismaService],
})
export class NewsModule {}
