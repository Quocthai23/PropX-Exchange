import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupportTicketStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateSupportDto } from '../dto/create-support.dto';
import { UpdateSupportDto } from '../dto/update-support.dto';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';

const UNRESOLVED_STATUSES: SupportTicketStatus[] = [
  SupportTicketStatus.OPEN,
  SupportTicketStatus.IN_PROGRESS,
];

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createSupportDto: CreateSupportDto) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const unresolvedCount = await this.prisma.supportTicket.count({
      where: {
        userId,
        status: { in: UNRESOLVED_STATUSES },
        createdAt: {
          gte: oneHourAgo,
        },
      },
    });

    if (unresolvedCount >= 3) {
      throw new HttpException(
        'You can only create up to 3 unresolved support tickets per hour.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.create({
        data: {
          userId,
          subject: createSupportDto.subject,
        },
      });

      const message = await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: userId,
          content: createSupportDto.content,
        },
      });

      return {
        ...ticket,
        messages: [message],
      };
    });
  }

  findAll(user: JwtPayload) {
    const where =
      user.role === 'ADMIN' || user.role === 'SUPPORT_STAFF'
        ? undefined
        : { userId: user.sub };

    return this.prisma.supportTicket.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });
  }

  async findOne(id: string, user: JwtPayload) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    if (ticket.userId !== user.sub) {
      throw new ForbiddenException(
        'You can only view your own support tickets.',
      );
    }

    return ticket;
  }

  async update(id: string, updateSupportDto: UpdateSupportDto) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      select: {
        id: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    return this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: updateSupportDto.status,
      },
    });
  }
}
