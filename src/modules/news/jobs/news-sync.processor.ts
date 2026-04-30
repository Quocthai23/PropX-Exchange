import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ExternalNewsAggregationService } from '../services/external-news-aggregation.service';

@Processor('news-sync', {
  concurrency: 5,
})
export class NewsSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(NewsSyncProcessor.name);

  constructor(
    private readonly newsAggregationService: ExternalNewsAggregationService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const { providerId, action, newsIds } = job.data;

    if (action === 'sync-provider') {
      this.logger.log(`Processing news sync for provider: ${providerId}`);
      await this.newsAggregationService.syncProvider(providerId);
    } else if (action === 'analyze-sentiment') {
      this.logger.log(
        `Processing sentiment analysis for ${newsIds.length} articles`,
      );
      await this.newsAggregationService.analyzeSentimentAndTagAssets(newsIds);
    }
  }
}
