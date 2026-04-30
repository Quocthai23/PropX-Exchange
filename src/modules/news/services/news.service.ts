import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  ExternalNewsAggregationService,
  ExternalProviderId,
  NewsProviderCatalog,
} from './external-news-aggregation.service';

interface NewsArticleRecord {
  id: string;
  source: string;
  externalId: string | null;
  title: unknown;
  summary: unknown | null;
  content: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: Date;
  language: string | null;
  country: string | null;
  category: string | null;
  keywords: string | null;
  createdAt: Date;
}

interface NewsPrisma {
  newsArticle: {
    findMany(args: {
      where?: {
        source?: string;
      };
      orderBy: { publishedAt: 'asc' | 'desc' };
      take: number;
      skip?: number;
      cursor?: { id: string };
    }): Promise<NewsArticleRecord[]>;
  };
}

@Injectable()
export class NewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly externalAggregationService: ExternalNewsAggregationService,
  ) {}

  async syncNow(sources?: ExternalProviderId[]) {
    return this.externalAggregationService.syncLatestNews({
      trigger: 'manual',
      providers: sources,
    });
  }

  listSources(): NewsProviderCatalog[] {
    return this.externalAggregationService.getSourceCatalog();
  }

  async findAll(limit = 20, cursor?: string, source?: string) {
    const prisma = this.prisma as unknown as NewsPrisma;

    const rows = await prisma.newsArticle.findMany({
      where: source ? { source } : undefined,
      take: Math.min(Math.max(limit, 1), 100),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { publishedAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      source: row.source,
      externalId: row.externalId,
      title: row.title,
      summary: row.summary,
      content: row.content,
      url: row.url,
      imageUrl: row.imageUrl,
      publishedAt: row.publishedAt,
      language: row.language,
      country: row.country,
      category: row.category,
      keywords: row.keywords,
      createdAt: row.createdAt,
    }));
  }
}
