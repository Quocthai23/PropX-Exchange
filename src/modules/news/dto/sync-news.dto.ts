import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional } from 'class-validator';
import { ExternalProviderId } from '../services/external-news-aggregation.service';

const providerIds: ExternalProviderId[] = [
  'newsapi',
  'freenewsapi',
  'thenewsapi',
  'mediastack',
  'fcsapi',
  'contextualweb',
  'currents',
  'gnews',
  'newsdata',
  'opennews_canada',
];

export class SyncNewsDto {
  @ApiPropertyOptional({
    description:
      'Optional provider subset to sync. Empty means all enabled providers.',
    isArray: true,
    enum: providerIds,
  })
  @IsOptional()
  @IsArray()
  @IsIn(providerIds, { each: true })
  sources?: ExternalProviderId[];
}
