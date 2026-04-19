import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

export type ExternalValuationTarget = {
  source: 'batdongsan' | 'chotot' | 'custom';
  endpoint: string;
  assetId?: string;
  areaCode?: string;
  title?: string;
  currency?: string;
};

type ListingRecord = {
  price: number;
  area?: number;
  url?: string;
  title?: string;
  raw: Record<string, unknown>;
};

type SnapshotRecord = {
  id: string;
  assetId: string | null;
  areaCode: string | null;
  source: string;
  title: string | null;
  listingUrl: string | null;
  price: string | number;
  currency: string;
  landArea: string | number | null;
  pricePerM2: string | number | null;
  capturedAt: Date;
  createdAt: Date;
};

type ValuationPrisma = {
  assetValuationSnapshot: {
    create(args: {
      data: {
        assetId?: string;
        areaCode?: string;
        source: string;
        title?: string;
        listingUrl?: string;
        price: string | number;
        currency: string;
        landArea?: string | number;
        pricePerM2?: string | number;
        capturedAt: Date;
        rawPayload: unknown;
      };
    }): Promise<SnapshotRecord>;
    findMany(args: {
      where: {
        assetId?: string;
        areaCode?: string;
      };
      orderBy: { capturedAt: 'asc' | 'desc' };
      take: number;
    }): Promise<SnapshotRecord[]>;
  };
};

@Injectable()
export class ExternalValuationService {
  private readonly logger = new Logger(ExternalValuationService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async captureHourlyValuationSnapshots() {
    await this.captureSnapshots('cron');
  }

  async captureSnapshots(trigger: 'cron' | 'manual') {
    const targets = this.getTargetsFromEnv();

    if (targets.length === 0) {
      this.logger.debug('No valuation targets configured. Skip crawling.');
      return { trigger, targetsProcessed: 0, inserted: 0 };
    }

    const prisma = this.prisma as unknown as ValuationPrisma;
    let inserted = 0;

    for (const target of targets) {
      try {
        const payload = await this.fetchJson(target.endpoint);
        const listings = this.parseListings(payload);

        if (listings.length === 0) continue;

        const aggregated = this.aggregateListings(listings);

        await prisma.assetValuationSnapshot.create({
          data: {
            assetId: target.assetId,
            areaCode: target.areaCode,
            source: target.source,
            title:
              target.title ||
              `${target.source.toUpperCase()} median from ${listings.length} listings`,
            listingUrl: target.endpoint,
            price: aggregated.medianPrice,
            currency: target.currency || 'VND',
            landArea: aggregated.medianArea ?? undefined,
            pricePerM2: aggregated.medianPricePerM2 ?? undefined,
            capturedAt: new Date(),
            rawPayload: {
              trigger,
              listingCount: listings.length,
              sample: listings.slice(0, 10),
            },
          },
        });

        inserted += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown crawl error';
        this.logger.warn(
          `External valuation crawl failed (${target.source} - ${target.endpoint}): ${message}`,
        );
      }
    }

    this.logger.log(
      `Valuation crawl (${trigger}) finished. Inserted ${inserted}/${targets.length} snapshots.`,
    );

    return { trigger, targetsProcessed: targets.length, inserted };
  }

  async getHistory(params: {
    assetId?: string;
    areaCode?: string;
    limit: number;
  }) {
    const prisma = this.prisma as unknown as ValuationPrisma;

    const rows = await prisma.assetValuationSnapshot.findMany({
      where: {
        ...(params.assetId ? { assetId: params.assetId } : {}),
        ...(params.areaCode ? { areaCode: params.areaCode } : {}),
      },
      orderBy: { capturedAt: 'desc' },
      take: Math.min(Math.max(params.limit, 1), 365),
    });

    return rows.map((row) => ({
      id: row.id,
      assetId: row.assetId,
      areaCode: row.areaCode,
      source: row.source,
      title: row.title,
      listingUrl: row.listingUrl,
      price: Number(row.price),
      currency: row.currency,
      landArea: row.landArea === null ? null : Number(row.landArea),
      pricePerM2: row.pricePerM2 === null ? null : Number(row.pricePerM2),
      capturedAt: row.capturedAt,
      createdAt: row.createdAt,
    }));
  }

  private parseListings(payload: unknown): ListingRecord[] {
    const rows = this.extractRows(payload);

    return rows
      .map((row): ListingRecord | null => {
        const price = this.pickNumeric(row, ['price', 'priceVnd', 'amount']);
        if (!price || price <= 0) return null;

        const area = this.pickNumeric(row, ['area', 'landArea', 'sqm']);
        const url = this.pickString(row, ['url', 'link']);
        const title = this.pickString(row, ['title', 'headline', 'name']);

        const listing: ListingRecord = {
          price,
          raw: row,
        };

        if (typeof area === 'number') {
          listing.area = area;
        }

        if (typeof url === 'string') {
          listing.url = url;
        }

        if (typeof title === 'string') {
          listing.title = title;
        }

        return listing;
      })
      .filter((row): row is ListingRecord => row !== null);
  }

  private aggregateListings(listings: ListingRecord[]) {
    const prices = listings.map((item) => item.price).sort((a, b) => a - b);
    const areas = listings
      .map((item) => item.area)
      .filter((item): item is number => typeof item === 'number' && item > 0)
      .sort((a, b) => a - b);

    const pricesPerM2 = listings
      .filter((item) => typeof item.area === 'number' && item.area > 0)
      .map((item) => item.price / item.area!)
      .sort((a, b) => a - b);

    const medianPrice = this.median(prices);
    const medianArea = areas.length > 0 ? this.median(areas) : undefined;
    const medianPricePerM2 =
      pricesPerM2.length > 0 ? this.median(pricesPerM2) : undefined;

    return {
      medianPrice,
      medianArea,
      medianPricePerM2,
    };
  }

  private getTargetsFromEnv(): ExternalValuationTarget[] {
    const raw = process.env.EXTERNAL_VALUATION_TARGETS_JSON;

    if (!raw) {
      return [];
    }

    try {
      const data: unknown = JSON.parse(raw);

      if (!Array.isArray(data)) {
        return [];
      }

      return data.filter((item): item is ExternalValuationTarget => {
        if (typeof item !== 'object' || item === null) return false;

        const source = (item as { source?: unknown }).source;
        const endpoint = (item as { endpoint?: unknown }).endpoint;

        return (
          (source === 'batdongsan' ||
            source === 'chotot' ||
            source === 'custom') &&
          typeof endpoint === 'string' &&
          endpoint.length > 0
        );
      });
    } catch {
      this.logger.warn(
        'EXTERNAL_VALUATION_TARGETS_JSON is invalid JSON. External crawl skipped.',
      );
      return [];
    }
  }

  private extractRows(payload: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(payload)) {
      return payload.filter((item) => this.isObject(item));
    }

    if (!this.isObject(payload)) {
      return [];
    }

    const possibleKeys = [
      'data',
      'items',
      'results',
      'listings',
      'ads',
      'news',
    ];

    for (const key of possibleKeys) {
      const value = payload[key];

      if (Array.isArray(value)) {
        return value.filter((item) => this.isObject(item));
      }

      if (this.isObject(value)) {
        const nested = this.extractRows(value);
        if (nested.length > 0) return nested;
      }
    }

    return [];
  }

  private pickNumeric(
    row: Record<string, unknown>,
    keys: string[],
  ): number | undefined {
    for (const key of keys) {
      const value = row[key];

      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }

      if (typeof value === 'string') {
        const normalized = value.replace(/[.,\s]/g, '');
        const parsed = Number(normalized);
        if (Number.isFinite(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }

    return undefined;
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

  private median(values: number[]): number {
    const middle = Math.floor(values.length / 2);

    if (values.length % 2 === 1) {
      return values[middle];
    }

    return (values[middle - 1] + values[middle]) / 2;
  }

  private async fetchJson(url: string): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: 'GET',
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
