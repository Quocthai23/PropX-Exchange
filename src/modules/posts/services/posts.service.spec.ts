import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from './posts.service';
import { PrismaService } from '@/prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

const mockPrisma = {
  post: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  postLike: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  postBookmark: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  comment: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('PostsService', () => {
  let service: PostsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    jest.clearAllMocks();
  });

  describe('createPost', () => {
    it('should create post successfully', async () => {
      mockPrisma.post.create.mockResolvedValue({
        id: 'post-id',
        userId: 'user-id',
        content: 'Test post',
        mediaUrls: [],
      });

      const result = await service.createPost('user-id', {
        content: 'Test post',
        mediaUrls: [],
      } as any);

      expect(result.id).toEqual('post-id');
    });
  });

  describe('getPostById', () => {
    it('should throw NotFoundException if post not found', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null);

      await expect(service.getPostById('user-id', 'post-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updatePost', () => {
    it('should throw NotFoundException if post not found', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePost('user-id', 'post-id', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not post owner', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'post-id',
        userId: 'other-user-id',
      });

      await expect(
        service.updatePost('user-id', 'post-id', {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('togglePostLike', () => {
    it('should like post if not liked', async () => {
      mockPrisma.postLike.findUnique.mockResolvedValue(null);
      mockPrisma.postLike.create.mockResolvedValue({});

      const result = await service.togglePostLike('user-id', 'post-id');

      expect(result.isLiked).toEqual(true);
    });

    it('should unlike post if already liked', async () => {
      mockPrisma.postLike.findUnique.mockResolvedValue({ id: 'like-id' });
      mockPrisma.postLike.delete.mockResolvedValue({});

      const result = await service.togglePostLike('user-id', 'post-id');

      expect(result.isLiked).toEqual(false);
    });
  });
});
