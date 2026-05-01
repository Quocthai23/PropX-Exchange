import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UpsertRelationDto } from '../dto/create-user.dto';

@Injectable()
export class UserRelationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSuggestions(
    userId: string,
    take: number,
  ): Promise<Record<string, unknown>[]> {
    const safeTake = Math.min(Math.max(take || 5, 1), 50);
    const blockedRelations = await this.prisma.userRelation.findMany({
      where: {
        OR: [
          { fromUserId: userId, isBlocking: true },
          { toUserId: userId, isBlocking: true },
          { fromUserId: userId, isFollowing: true },
        ],
      },
      select: { fromUserId: true, toUserId: true },
    });

    const excluded = new Set<string>([userId]);
    for (const relation of blockedRelations) {
      excluded.add(relation.fromUserId);
      excluded.add(relation.toUserId);
    }

    const candidates = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        id: { notIn: [...excluded] },
      },
      take: safeTake,
      select: {
        id: true,
        username: true,
        avatar: true,
        displayName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return candidates;
  }

  async getRelations(
    targetUserId: string,
    relationType: string,
    skip: number,
    take: number,
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    let where: Record<string, unknown> = {};
    let includeUser: 'fromUser' | 'toUser' = 'toUser';

    if (relationType === 'followings') {
      where = { fromUserId: targetUserId, isFollowing: true };
      includeUser = 'toUser';
    } else if (relationType === 'follower') {
      where = { toUserId: targetUserId, isFollowing: true };
      includeUser = 'fromUser';
    } else if (relationType === 'block') {
      where = { fromUserId: targetUserId, isBlocking: true };
      includeUser = 'toUser';
    }

    const [relations, total] = await Promise.all([
      this.prisma.userRelation.findMany({
        where,
        skip,
        take,
        include: {
          [includeUser]: {
            select: {
              id: true,
              username: true,
              avatar: true,
              displayName: true,
            },
          },
        },
      }),
      this.prisma.userRelation.count({ where }),
    ]);

    const data = relations.map((relation) => ({
      ...(relation[includeUser] as Record<string, unknown>),
    }));

    return { data, total };
  }

  async upsertRelation(
    currentUserId: string,
    targetUserId: string,
    dto: UpsertRelationDto,
  ): Promise<{
    isFollowing: boolean;
    isBlocking: boolean;
    isBlockedBy: boolean;
  }> {
    if (currentUserId === targetUserId) {
      throw new BadRequestException('cannot-relate-to-self');
    }

    const existingRelation = await this.prisma.userRelation.findUnique({
      where: {
        fromUserId_toUserId: {
          fromUserId: currentUserId,
          toUserId: targetUserId,
        },
      },
    });

    const incomingRelation = await this.prisma.userRelation.findUnique({
      where: {
        fromUserId_toUserId: {
          fromUserId: targetUserId,
          toUserId: currentUserId,
        },
      },
    });

    const relationData: Record<string, unknown> = {};

    switch (dto.action) {
      case 'follow':
        relationData.isFollowing = true;
        relationData.isBlocking = false;
        break;
      case 'unfollow':
        relationData.isFollowing = false;
        break;
      case 'block':
        relationData.isBlocking = true;
        relationData.isFollowing = false;
        break;
      case 'unblock':
        relationData.isBlocking = false;
        break;
    }

    let relation;
    if (existingRelation) {
      relation = await this.prisma.userRelation.update({
        where: { id: existingRelation.id },
        data: relationData,
      });
    } else {
      relation = await this.prisma.userRelation.create({
        data: {
          fromUserId: currentUserId,
          toUserId: targetUserId,
          ...relationData,
        },
      });
    }

    return {
      isFollowing: relation.isFollowing,
      isBlocking: relation.isBlocking,
      isBlockedBy: incomingRelation?.isBlocking || false,
    };
  }
}
