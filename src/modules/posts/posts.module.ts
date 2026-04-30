import { Module } from '@nestjs/common';
import { PostsController } from './controllers/posts.controller';
import { PostsService } from './services/posts.service';
import { PrismaService } from '@/prisma/prisma.service';

import { BullModule } from '@nestjs/bullmq';
import { PostsProcessor } from './jobs/posts.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'posts',
    }),
  ],
  controllers: [PostsController],
  providers: [PostsService, PrismaService, PostsProcessor],
})
export class PostsModule {}
