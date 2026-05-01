import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UpdateProfileDto, UpdateReferralDto } from '../dto/update-user.dto';
import {
  ToggleFavoriteAssetDto,
  UpsertRelationDto,
} from '../dto/create-user.dto';
import { UserPortfolioService } from './user-portfolio.service';
import { UserRelationsService } from './user-relations.service';

interface UsersPrisma {
  user: {
    findUnique(args: Record<string, unknown>): Promise<any>;
    update(args: Record<string, unknown>): Promise<any>;
    findMany(args: Record<string, unknown>): Promise<any[]>;
  };
  userRelation: {
    count(args: Record<string, unknown>): Promise<number>;
    findUnique(args: Record<string, unknown>): Promise<any>;
  };
  favoriteAsset: {
    findUnique(args: Record<string, unknown>): Promise<any>;
    delete(args: Record<string, unknown>): Promise<any>;
    create(args: Record<string, unknown>): Promise<any>;
  };
}

@Injectable()
export class UsersService {
  private readonly prisma: UsersPrisma;

  constructor(
    prismaService: PrismaService,
    private readonly portfolioService: UserPortfolioService,
    private readonly relationsService: UserRelationsService,
  ) {
    this.prisma = prismaService as unknown as UsersPrisma;
  }

  healthCheck() {
    return { message: 'Users module is running.' };
  }

  async getPublicProfile(
    id: string,
    currentUserId?: string,
  ): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        createdAt: true,
        avatar: true,
        gender: true,
        bio: true,
        coverAvatar: true,
        displayName: true,
        status: true,
      },
    });
    if (!user) throw new NotFoundException('user-not-found');

    const [followerCount, followingCount, currentUserRelation] =
      await Promise.all([
        this.prisma.userRelation.count({
          where: { toUserId: id, isFollowing: true },
        }),
        this.prisma.userRelation.count({
          where: { fromUserId: id, isFollowing: true },
        }),
        currentUserId
          ? this.prisma.userRelation.findUnique({
              where: {
                fromUserId_toUserId: {
                  fromUserId: currentUserId,
                  toUserId: id,
                },
              },
            })
          : null,
      ]);

    const isFollowing = currentUserRelation?.isFollowing || false;
    const isBlocking = currentUserRelation?.isBlocking || false;

    const isBlockedBy = currentUserId
      ? !!(
          await this.prisma.userRelation.findUnique({
            where: {
              fromUserId_toUserId: { fromUserId: id, toUserId: currentUserId },
            },
          })
        )?.isBlocking
      : false;

    return {
      ...user,
      followerCount,
      followingCount,
      isFollowing,
      isBlocking,
      isBlockedBy,
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<{ success: boolean }> {
    const updateData: Record<string, unknown> = {};
    if (dto.username) updateData.username = dto.username;
    if (dto.avatar !== undefined) updateData.avatar = dto.avatar;
    if (dto.gender !== undefined) updateData.gender = dto.gender;
    if (dto.bio !== undefined) updateData.bio = dto.bio;
    if (dto.coverAvatar !== undefined) updateData.coverAvatar = dto.coverAvatar;
    if (dto.displayName !== undefined) updateData.displayName = dto.displayName;

    if (Object.keys(updateData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }
    return { success: true };
  }

  async getMyProfile(userId: string): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('user-not-found');
    return {
      ...user,
      hasPassword: !!user.passwordHash,
    };
  }

  async softDeleteAccount(userId: string): Promise<{ success: boolean }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'DELETED' },
    });
    return { success: true };
  }

  async toggleFavoriteAsset(
    userId: string,
    dto: ToggleFavoriteAssetDto,
  ): Promise<{ isFavorite: boolean }> {
    const existingFavorite = await this.prisma.favoriteAsset.findUnique({
      where: { userId_assetId: { userId, assetId: dto.assetId } },
    });

    if (existingFavorite) {
      await this.prisma.favoriteAsset.delete({
        where: { id: existingFavorite.id },
      });
      return { isFavorite: false };
    } else {
      await this.prisma.favoriteAsset.create({
        data: { userId, assetId: dto.assetId },
      });
      return { isFavorite: true };
    }
  }

  async updateReferral(
    userId: string,
    dto: UpdateReferralDto,
  ): Promise<{ success: boolean }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { referenceCode: dto.referenceCode },
    });
    return { success: true };
  }

  // Delegated to UserPortfolioService
  async getPortfolioOverview(userId: string) {
    return this.portfolioService.getPortfolioOverview(userId);
  }

  // Delegated to UserRelationsService
  async getSuggestions(userId: string, take: number) {
    return this.relationsService.getSuggestions(userId, take);
  }

  async getRelations(
    targetUserId: string,
    relationType: string,
    skip: number,
    take: number,
  ) {
    return this.relationsService.getRelations(targetUserId, relationType, skip, take);
  }

  async upsertRelation(
    currentUserId: string,
    targetUserId: string,
    dto: UpsertRelationDto,
  ) {
    return this.relationsService.upsertRelation(currentUserId, targetUserId, dto);
  }
}
