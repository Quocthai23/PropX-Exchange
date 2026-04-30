import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { createClient, RedisClientType } from 'redis';
import { AppConfigService } from '@/config/app-config.service';

@Processor('posts', {
  concurrency: 5,
})
export class PostsProcessor
  extends WorkerHost
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PostsProcessor.name);
  private redisClient: RedisClientType; // Dùng Type rõ ràng thay vì 'any'

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {
    super();
    this.redisClient = createClient({
      url: this.config.redisUrl || 'redis://localhost:6379',
    });

    this.redisClient.on('error', (err) =>
      this.logger.error('Redis Error:', err),
    );
  }

  // Quản lý lifecycle chuẩn NestJS
  async onModuleInit() {
    await this.redisClient.connect();
    this.logger.log('Redis connected for PostsProcessor');
  }

  async onModuleDestroy() {
    if (this.redisClient.isOpen) {
      await this.redisClient.disconnect();
    }
  }

  async process(job: Job<any>): Promise<any> {
    if (job.name === 'distribute-post') {
      const { postId, authorId } = job.data;
      this.logger.log(`Distributing post ${postId} from author ${authorId}`);

      const BATCH_SIZE = 2000; // Xử lý 2000 follower mỗi cụm (Batch)
      let lastId: string | undefined = undefined;
      let totalDistributed = 0;
      let hasMore = true;

      // Kỹ thuật Cursor-based loop để xử lý hàng triệu Follower không bị OOM
      while (hasMore) {
        const followers = await this.prisma.userRelation.findMany({
          where: { toUserId: authorId, isFollowing: true },
          select: { id: true, fromUserId: true },
          take: BATCH_SIZE,
          skip: lastId ? 1 : 0,
          cursor: lastId ? { id: lastId } : undefined,
          orderBy: { id: 'asc' }, // Bắt buộc order khi dùng cursor
        });

        if (followers.length === 0) {
          hasMore = false;
          break;
        }

        const multi = this.redisClient.multi();

        for (const follower of followers) {
          const feedKey = `feed:user:${follower.fromUserId}`;
          multi.lPush(feedKey, postId);
          multi.lTrim(feedKey, 0, 999);
        }

        await multi.exec(); // Đẩy 2000 lệnh tới Redis cùng lúc

        totalDistributed += followers.length;
        lastId = followers[followers.length - 1].id; // Lấy ID cuối để lặp tiếp

        // Nếu lấy ra ít hơn số lượng mong muốn => Đã hết dữ liệu
        if (followers.length < BATCH_SIZE) {
          hasMore = false;
        }
      }

      this.logger.log(
        `Success: Distributed post ${postId} to ${totalDistributed} followers.`,
      );
    }
  }
}
