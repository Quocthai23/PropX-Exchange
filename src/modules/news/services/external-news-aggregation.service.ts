import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';

export type ExternalProviderId =
  | 'newsapi'
  | 'freenewsapi'
  | 'thenewsapi'
  | 'mediastack'
  | 'fcsapi'
  | 'contextualweb'
  | 'currents'
  | 'gnews'
  | 'newsdata'
  | 'opennews_canada';

export type NewsProviderCatalog = {
  id: ExternalProviderId;
  name: string;
  website: string;
  highlights: string;
  freeLimit: string;
  notes: string;
  enabled: boolean;
};

type ProviderDescriptor = {
  id: ExternalProviderId;
  name: string;
  website: string;
  highlights: string;
  freeLimit: string;
  notes: string;
  enabled: boolean;
  request: {
    url: string;
    headers?: Record<string, string>;
  };
};

type SyncNewsOptions = {
  trigger: 'cron' | 'manual';
  providers?: ExternalProviderId[];
};

type NormalizedArticle = {
  externalId: string | null;
  dedupeKey: string;
  source: string;
  title: string;
  summary: string | null;
  content: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: Date;
  language: string | null;
  country: string | null;
  category: string | null;
  keywords: string | null;
  rawPayload: unknown;
};

type NewsPrisma = {
  newsArticle: {
    createMany(args: {
      data: Array<{
        source: string;
        externalId: string | null;
        dedupeKey: string;
        title: string;
        summary: string | null;
        content: string | null;
        url: string;
        imageUrl: string | null;
        publishedAt: Date;
        language: string | null;
        country: string | null;
        category: string | null;
        keywords: string | null;
        rawPayload: unknown;
      }>;
      skipDuplicates: boolean;
    }): Promise<{ count: number }>;
  };
};

@Injectable()
export class ExternalNewsAggregationService {
  private readonly logger = new Logger(ExternalNewsAggregationService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlySync() {
    await this.syncLatestNews({ trigger: 'cron' });
  }

  getSourceCatalog(): NewsProviderCatalog[] {
    return this.buildProviderDescriptors().map((provider) => ({
      id: provider.id,
      name: provider.name,
      website: provider.website,
      highlights: provider.highlights,
      freeLimit: provider.freeLimit,
      notes: provider.notes,
      enabled: provider.enabled,
    }));
  }

  async syncLatestNews(options: SyncNewsOptions) {
    const prisma = this.prisma as unknown as NewsPrisma;
    const providerFilter =
      options.providers && options.providers.length > 0
        ? new Set(options.providers)
        : null;

    const providers = this.buildProviderDescriptors().filter(
      (provider) =>
        provider.enabled &&
        (!providerFilter || providerFilter.has(provider.id)),
    );

    if (providers.length === 0) {
      this.logger.warn('No external news provider is enabled.');
      return {
        trigger: options.trigger,
        providersProcessed: 0,
        inserted: 0,
      };
    }

    let inserted = 0;

    for (const provider of providers) {
      try {
        const payload = await this.fetchJson(
          provider.request.url,
          provider.request.headers,
        );
        const rows = this.normalizeProviderPayload(provider.id, payload);

        if (rows.length === 0) {
          this.logger.debug(`No rows parsed from ${provider.id}.`);
          continue;
        }

        const created = await prisma.newsArticle.createMany({
          data: rows,
          skipDuplicates: true,
        });

        inserted += created.count;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown provider error';
        this.logger.warn(`Failed to sync provider ${provider.id}: ${message}`);
      }
    }

    this.logger.log(
      `External news sync (${options.trigger}) finished. Inserted ${inserted} rows from ${providers.length} providers.`,
    );

    return {
      trigger: options.trigger,
      providersProcessed: providers.length,
      inserted,
    };
  }

  private buildProviderDescriptors(): ProviderDescriptor[] {
    const language = process.env.EXTERNAL_NEWS_LANGUAGE || 'en';
    const country = process.env.EXTERNAL_NEWS_COUNTRY || 'us';

    const newsApiKey = process.env.NEWSAPI_API_KEY;
    const freeNewsApiKey = process.env.FREENEWSAPI_API_KEY;
    const theNewsApiKey = process.env.THENEWSAPI_API_KEY;
    const mediastackKey = process.env.MEDIASTACK_API_KEY;
    const fcsApiKey = process.env.FCSAPI_API_KEY;
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    const currentsApiKey = process.env.CURRENTS_API_KEY;
    const gnewsApiKey = process.env.GNEWS_API_KEY;
    const newsDataApiKey = process.env.NEWSDATA_API_KEY;
    const openNewsFeedUrl = process.env.OPENNEWS_CANADA_FEED_URL;

    return [
      {
        id: 'newsapi',
        name: 'NewsAPI.org',
        website: 'https://newsapi.org/',
        highlights:
          '30k+ sources, filters by country/category/keyword/language',
        freeLimit: '100 requests/day (development)',
        notes: 'Free plan returns truncated content',
        enabled: Boolean(newsApiKey),
        request: {
          url: `${process.env.NEWSAPI_BASE_URL || 'https://newsapi.org'}/v2/top-headlines?language=${language}&country=${country}&pageSize=25&apiKey=${newsApiKey || ''}`,
        },
      },
      {
        id: 'freenewsapi',
        name: 'FreeNewsAPI',
        website: 'https://freenewsapi.com/',
        highlights: '15M+ articles, 60k+ publishers, 22 languages',
        freeLimit: '100 requests/day, max 5 articles/request',
        notes: 'Full content is paid-only',
        enabled: Boolean(freeNewsApiKey),
        request: {
          url: `${process.env.FREENEWSAPI_BASE_URL || 'https://freenewsapi.com'}/api/v1/news?apikey=${freeNewsApiKey || ''}&lang=${language}`,
        },
      },
      {
        id: 'thenewsapi',
        name: 'TheNewsAPI',
        website: 'https://newsapi.world/',
        highlights: 'Global news with webhook support',
        freeLimit: '500 requests/month',
        notes: 'Requires apiKey',
        enabled: Boolean(theNewsApiKey),
        request: {
          url: `${process.env.THENEWSAPI_BASE_URL || 'https://api.thenewsapi.com'}/v1/news/top?api_token=${theNewsApiKey || ''}&language=${language}&limit=20`,
        },
      },
      {
        id: 'mediastack',
        name: 'Mediastack',
        website: 'https://mediastack.com/',
        highlights: 'Real-time multilingual news feeds',
        freeLimit: '500 requests/month',
        notes: 'Free plan returns snippets only',
        enabled: Boolean(mediastackKey),
        request: {
          url: `${process.env.MEDIASTACK_BASE_URL || 'http://api.mediastack.com'}/v1/news?access_key=${mediastackKey || ''}&languages=${language}&limit=25`,
        },
      },
      {
        id: 'fcsapi',
        name: 'FCS API News',
        website: 'https://news.fcsapi.com/',
        highlights: 'High-volume feed with flexible filtering',
        freeLimit: '100 requests/day',
        notes: 'No credit card required',
        enabled: Boolean(fcsApiKey),
        request: {
          url: `${process.env.FCSAPI_BASE_URL || 'https://fcsapi.com'}/api-v3/news/latest?access_key=${fcsApiKey || ''}&language=${language}`,
        },
      },
      {
        id: 'contextualweb',
        name: 'ContextualWeb via RapidAPI',
        website: 'https://rapidapi.com/contextualwebsearch/api/websearch',
        highlights: 'Keyword search API with title/description/url/thumbnail',
        freeLimit: '1000 requests/day',
        notes: 'Requires RapidAPI key',
        enabled: Boolean(rapidApiKey),
        request: {
          url: `${process.env.CONTEXTUALWEB_BASE_URL || 'https://contextualwebsearch-websearch-v1.p.rapidapi.com'}/api/search/NewsSearchAPI?q=${encodeURIComponent(process.env.EXTERNAL_NEWS_KEYWORD || 'rwa investment')}&pageNumber=1&pageSize=20&autoCorrect=true`,
          headers: {
            'X-RapidAPI-Key': rapidApiKey || '',
            'X-RapidAPI-Host':
              process.env.CONTEXTUALWEB_RAPIDAPI_HOST ||
              'contextualwebsearch-websearch-v1.p.rapidapi.com',
          },
        },
      },
      {
        id: 'currents',
        name: 'Currents API',
        website: 'https://currentsapi.com/',
        highlights: 'Breaking and latest news from 30k+ sources',
        freeLimit: '1000 requests/day',
        notes: 'Requires apiKey',
        enabled: Boolean(currentsApiKey),
        request: {
          url: `${process.env.CURRENTS_BASE_URL || 'https://api.currentsapi.services'}/v1/latest-news?language=${language}&apiKey=${currentsApiKey || ''}`,
        },
      },
      {
        id: 'gnews',
        name: 'GNews API',
        website: 'https://gnews.io/',
        highlights: 'Google News-like aggregation by language/country/topic',
        freeLimit: '100 requests/day',
        notes: 'Max 10 articles per request in free plan',
        enabled: Boolean(gnewsApiKey),
        request: {
          url: `${process.env.GNEWS_BASE_URL || 'https://gnews.io'}/api/v4/top-headlines?lang=${language}&country=${country}&max=10&apikey=${gnewsApiKey || ''}`,
        },
      },
      {
        id: 'newsdata',
        name: 'NewsData.io',
        website: 'https://newsdata.io/',
        highlights: 'Country/category/language filters',
        freeLimit: '200 requests/day',
        notes: 'Requires apikey',
        enabled: Boolean(newsDataApiKey),
        request: {
          url: `${process.env.NEWSDATA_BASE_URL || 'https://newsdata.io'}/api/1/latest?apikey=${newsDataApiKey || ''}&language=${language}`,
        },
      },
      {
        id: 'opennews_canada',
        name: 'OpenNews Canada',
        website:
          'https://open.canada.ca/data/en/dataset/39f5fe9e-f1fd-4bb3-9b5c-1d8c5c7265a6',
        highlights: 'Open RSS/JSON/CSV datasets from 120+ Canada sources',
        freeLimit: 'Public and unlimited',
        notes: 'Best for Canada-focused projects',
        enabled: Boolean(openNewsFeedUrl),
        request: {
          url: openNewsFeedUrl || '',
        },
      },
    ];
  }

  private normalizeProviderPayload(
    source: ExternalProviderId,
    payload: unknown,
  ): NormalizedArticle[] {
    const rows = this.extractArrayPayload(payload);

    return rows
      .map((row) => this.normalizeRow(source, row))
      .filter((row): row is NormalizedArticle => row !== null);
  }

  private normalizeRow(
    source: ExternalProviderId,
    row: Record<string, unknown>,
  ): NormalizedArticle | null {
    const title = this.pickString(row, ['title', 'headline', 'name']);
    const url = this.pickString(row, ['url', 'link', 'newsUrl']);

    if (!title || !url) return null;

    const publishedAtRaw = this.pickString(row, [
      'publishedAt',
      'published_at',
      'pubDate',
      'date',
      'createdAt',
      'created_at',
    ]);

    const publishedAt = publishedAtRaw ? new Date(publishedAtRaw) : new Date();

    if (Number.isNaN(publishedAt.getTime())) return null;

    const externalId = this.pickString(row, ['id', 'uuid', 'guid']) || null;
    const dedupeKey = `${source}:${externalId || url}`;

    return {
      source,
      externalId,
      dedupeKey,
      title,
      summary:
        this.pickString(row, ['description', 'summary', 'snippet']) || null,
      content: this.pickString(row, ['content', 'body']) || null,
      url,
      imageUrl:
        this.pickString(row, [
          'image',
          'image_url',
          'urlToImage',
          'thumbnail',
        ]) || null,
      publishedAt,
      language: this.pickString(row, ['language', 'lang']) || null,
      country: this.pickString(row, ['country']) || null,
      category: this.pickString(row, ['category']) || null,
      keywords: this.joinKeywords(row),
      rawPayload: row,
    };
  }

  private extractArrayPayload(payload: unknown): Record<string, unknown>[] {
    if (Array.isArray(payload)) {
      return payload.filter((item) => this.isObject(item));
    }

    if (!this.isObject(payload)) {
      return [];
    }

    const directKeys = [
      'articles',
      'data',
      'news',
      'results',
      'value',
      'response',
      'items',
    ];

    for (const key of directKeys) {
      const value = payload[key];

      if (Array.isArray(value)) {
        return value.filter((item) => this.isObject(item));
      }

      if (this.isObject(value)) {
        const nested = this.extractArrayPayload(value);
        if (nested.length > 0) return nested;
      }
    }

    return [];
  }

  private pickString(
    row: Record<string, unknown>,
    keys: string[],
  ): string | undefined {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }

    return undefined;
  }

  private joinKeywords(row: Record<string, unknown>): string | null {
    const keywords = row.keywords;

    if (Array.isArray(keywords)) {
      const values = keywords.filter(
        (value): value is string => typeof value === 'string',
      );

      return values.length > 0 ? values.join(',') : null;
    }

    if (typeof keywords === 'string' && keywords.trim().length > 0) {
      return keywords;
    }

    return null;
  }

  private async fetchJson(
    url: string,
    headers?: Record<string, string>,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
