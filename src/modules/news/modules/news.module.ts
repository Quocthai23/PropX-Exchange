import { Module } from '@nestjs/common';
import { NewsService } from '../services/news.service';
import { NewsController } from '../controllers/news.controller';

@Module({
  controllers: [NewsController],
  providers: [NewsService],
})
export class NewsModule {}
