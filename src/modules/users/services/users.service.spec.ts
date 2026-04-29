import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '@/prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  userRelation: {
    count: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  favoriteAsset: {
    findUnique: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
  },
  balance: {
    findMany: jest.fn(),
  },
  transaction: {
    findMany: jest.fn(),
  },
  asset: {
    findMany: jest.fn(),
  },
  order: {
    findFirst: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('healthCheck', () => {
    it('should return a health check message', () => {
      expect(service.healthCheck()).toEqual({
        message: 'Users module is running.',
      });
    });
  });

  describe('getPublicProfile', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getPublicProfile('test-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return public profile with counts', async () => {
      const mockUser = {
        id: 'test-id',
        username: 'testuser',
        createdAt: new Date(),
        avatar: 'test-avatar',
        gender: 'MALE',
        bio: 'test bio',
        coverAvatar: 'test-cover',
        displayName: 'Test User',
        status: 'ACTIVE',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.userRelation.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5);
      mockPrisma.userRelation.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await service.getPublicProfile(
        'test-id',
        'current-user-id',
      );

      expect(result).toEqual({
        ...mockUser,
        followerCount: 10,
        followingCount: 5,
        isFollowing: false,
        isBlocking: false,
        isBlockedBy: false,
      });
    });
  });

  describe('getMyProfile', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMyProfile('test-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return user profile with hasPassword flag', async () => {
      const mockUser = {
        id: 'test-id',
        email: 'test@test.com',
        passwordHash: 'hashed-password',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getMyProfile('test-id');

      expect(result).toEqual({ ...mockUser, hasPassword: true });
    });
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const updateData = { username: 'newusername' };
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.updateProfile('test-id', updateData as any);

      expect(result).toEqual({ success: true });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: updateData,
      });
    });
  });

  describe('softDeleteAccount', () => {
    it('should soft delete the account', async () => {
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.softDeleteAccount('test-id');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: { status: 'DELETED' },
      });
    });
  });

  describe('toggleFavoriteAsset', () => {
    it('should remove favorite if exists', async () => {
      mockPrisma.favoriteAsset.findUnique.mockResolvedValue({ id: 'fav-id' });
      mockPrisma.favoriteAsset.delete.mockResolvedValue({});

      const result = await service.toggleFavoriteAsset('user-id', {
        assetId: 'asset-id',
      });

      expect(result).toEqual({ isFavorite: false });
    });

    it('should add favorite if not exists', async () => {
      mockPrisma.favoriteAsset.findUnique.mockResolvedValue(null);
      mockPrisma.favoriteAsset.create.mockResolvedValue({});

      const result = await service.toggleFavoriteAsset('user-id', {
        assetId: 'asset-id',
      });

      expect(result).toEqual({ isFavorite: true });
    });
  });

  describe('upsertRelation', () => {
    it('should throw BadRequestException if relating to self', async () => {
      await expect(
        service.upsertRelation('same-id', 'same-id', {
          action: 'follow',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should follow user', async () => {
      mockPrisma.userRelation.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockPrisma.userRelation.create.mockResolvedValue({
        isFollowing: true,
        isBlocking: false,
      });

      const result = await service.upsertRelation('current-id', 'target-id', {
        action: 'follow',
      } as any);

      expect(result).toEqual({
        isFollowing: true,
        isBlocking: false,
        isBlockedBy: false,
      });
    });
  });
});
