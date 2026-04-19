import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { NewsService } from '../services/news.service';
import { SyncNewsDto } from '../dto/sync-news.dto';
import { NewsProviderCatalog } from '../services/external-news-aggregation.service';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get('sources')
  listSources(): NewsProviderCatalog[] {
    return this.newsService.listSources();
  }

  @Get()
  findAll(@Query('limit') limit?: string, @Query('source') source?: string) {
    return this.newsService.findAll(Number(limit || 30), source);
  }

  @Post('sync')
  sync(@Body() body: SyncNewsDto) {
    return this.newsService.syncNow(body.sources);
  }
}
