import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreatePostDto } from '../dto/create-post.dto';
import {
  QueryPostsDto,
  PaginationQueryDto,
  CommentDto,
} from '../dto/posts.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createClient } from 'redis';
import { AppConfigService } from '@/config/app-config.service';

@Injectable()
export class PostsService {
  private redisClient: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    @InjectQueue('posts') private readonly postsQueue: Queue,
  ) {
    this.redisClient = createClient({
      url: this.config.redisUrl || 'redis://localhost:6379',
    });
    this.redisClient.connect().catch(console.error);
  }

  async getPosts(userId: string, query: QueryPostsDto) {
    const where: any = {};
    const limit = query.take || 20;
    const cursorObj = (query as any).cursor
      ? { id: (query as any).cursor }
      : undefined;

    // Use Redis Feed if possible
    let redisPostIds: string[] = [];
    if (!where.userId && !(query as any).cursor) {
      // Trying to fetch the main feed for the user
      const feedKey = `feed:user:${userId}`;
      // In a real app we'd paginate Redis as well using LRANGE with skip logic,
      // but for simplicity we fetch top limit items.
      redisPostIds = await this.redisClient.lRange(feedKey, 0, limit - 1);
    }

    if (redisPostIds.length > 0) {
      where.id = { in: redisPostIds };
    }

    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy: redisPostIds.length ? undefined : { createdAt: 'desc' },
        take: limit,
        skip: cursorObj ? 1 : 0,
        cursor: cursorObj,
        include: {
          user: true,
          likes: {
            where: { userId },
            select: { id: true },
          },
          bookmarks: {
            where: { userId },
            select: { id: true },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              bookmarks: true,
            },
          },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return { data, total };
  }

  async getBookmarkedPosts(userId: string, query: PaginationQueryDto) {
    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        where: {
          bookmarks: {
            some: { userId },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip || 0,
        take: query.take || 20,
        include: {
          user: true,
          likes: {
            where: { userId },
            select: { id: true },
          },
          bookmarks: {
            where: { userId },
            select: { id: true },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              bookmarks: true,
            },
          },
        },
      }),
      this.prisma.post.count({
        where: {
          bookmarks: {
            some: { userId },
          },
        },
      }),
    ]);

    return { data, total };
  }

  async getPostById(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: true,
        likes: {
          where: { userId },
          select: { id: true },
        },
        bookmarks: {
          where: { userId },
          select: { id: true },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            bookmarks: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async createPost(userId: string, dto: CreatePostDto) {
    const post = await this.prisma.post.create({
      data: {
        userId,
        content: dto.content,
        mediaUrls: (dto.linksUrl || []) as any,
      },
      include: {
        user: true,
      },
    });

    // 1. Enqueue distribute-post event
    await this.postsQueue.add('distribute-post', {
      postId: post.id,
      authorId: userId,
    });

    // 2. Extract Cashtags
    if (dto.content) {
      const cashtags = dto.content.match(/\$[A-Z0-9]+/g);
      if (cashtags && cashtags.length > 0) {
        // Remove $ sign and deduplicate
        const symbols = Array.from(
          new Set(cashtags.map((tag) => tag.substring(1))),
        );

        // Find matching assets
        const assets = await this.prisma.asset.findMany({
          where: { symbol: { in: symbols } },
          select: { id: true },
        });

        if (assets.length > 0) {
          await this.prisma.postCashtag.createMany({
            data: assets.map((a) => ({
              postId: post.id,
              assetId: a.id,
            })),
            skipDuplicates: true,
          });
        }
      }
    }

    return post;
  }

  async updatePost(
    userId: string,
    postId: string,
    dto: Partial<CreatePostDto>,
  ) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.userId !== userId) {
      throw new ForbiddenException('Not post owner');
    }

    return this.prisma.post.update({
      where: { id: postId },
      data: {
        content: dto.content,
        mediaUrls: dto.linksUrl as any,
      },
    });
  }

  async deletePost(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.userId !== userId) {
      throw new ForbiddenException('Not post owner');
    }

    await this.prisma.post.delete({
      where: { id: postId },
    });

    return { success: true };
  }

  async togglePostLike(userId: string, postId: string) {
    const existingLike = await this.prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existingLike) {
      await this.prisma.postLike.delete({
        where: { postId_userId: { postId, userId } },
      });
      return { isLiked: false };
    } else {
      await this.prisma.postLike.create({
        data: { postId, userId },
      });
      return { isLiked: true };
    }
  }

  async togglePostBookmark(userId: string, postId: string) {
    const existingBookmark = await this.prisma.postBookmark.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existingBookmark) {
      await this.prisma.postBookmark.delete({
        where: { postId_userId: { postId, userId } },
      });
      return { isBookmarked: false };
    } else {
      await this.prisma.postBookmark.create({
        data: { postId, userId },
      });
      return { isBookmarked: true };
    }
  }

  async getPostComments(
    _userId: string,
    postId: string,
    query: PaginationQueryDto,
  ) {
    const [data, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { postId },
        orderBy: { createdAt: 'desc' },
        skip: query.skip || 0,
        take: query.take || 20,
        include: { user: true },
      }),
      this.prisma.comment.count({ where: { postId } }),
    ]);

    return { data, total };
  }

  async createComment(userId: string, postId: string, dto: CommentDto) {
    return this.prisma.comment.create({
      data: {
        postId,
        userId,
        content: dto.content,
      },
      include: { user: true },
    });
  }

  async updateComment(userId: string, commentId: string, dto: CommentDto) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('Not comment owner');
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { content: dto.content },
    });
  }

  async deleteComment(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('Not comment owner');
    }

    await this.prisma.comment.delete({
      where: { id: commentId },
    });

    return { success: true };
  }

  async toggleCommentLike(_userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return { isLiked: true };
  }
}
