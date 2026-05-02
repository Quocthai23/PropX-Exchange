import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { $Enums } from '@prisma/client';
import {
  CreateSupportTicketDto,
  UpdateSupportTicketDto,
  SupportMessageDto,
  GetSupportTicketsQueryDto,
  AdminGetSupportTicketsQueryDto,
  GetMessagesQueryDto,
} from '../dto/support.dto';

import { SupportGateway } from '../gateways/support.gateway';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supportGateway: SupportGateway,
  ) {}

  async createTicket(userId: string, dto: CreateSupportTicketDto) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.create({
        data: {
          userId,
          subject: dto.subject,
          title: dto.title,
          category: dto.category,
          priority: dto.priority,
          status: $Enums.SupportTicketStatus.OPEN,
        },
      });

      await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: userId,
          content: dto.message,
          attachments: dto.attachments ?? undefined,
        },
      });

      this.supportGateway.broadcastNewMessage(
        ticket.id,
        Object.assign({}, dto, { id: ticket.id }),
      );

      return ticket;
    });
  }

  async getMyTickets(userId: string, query: GetSupportTicketsQueryDto) {
    const where: any = { userId };
    if (query.status) {
      where.status = query.status;
    }
    if (query.category) {
      where.category = query.category;
    }

    const take = query.take || 20;
    const [data, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    let nextCursor: string | null = null;
    if (data.length > take) {
      const nextItem = data.pop();
      nextCursor = nextItem?.id ?? null;
    }

    return { data, total, nextCursor };
  }

  async getTicketDetail(userId: string, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: true, messages: { include: { sender: true } } },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.userId !== userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== 'ADMIN') {
        throw new ForbiddenException('Not ticket owner');
      }
    }

    return ticket;
  }

  async updateTicket(
    userId: string,
    ticketId: string,
    dto: UpdateSupportTicketDto,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.userId !== userId) {
      throw new ForbiddenException('Not ticket owner');
    }

    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        subject: dto.subject,
        title: dto.title,
        category: dto.category,
        priority: dto.priority,
      },
    });
  }

  async getTicketMessages(
    userId: string,
    ticketId: string,
    query: GetMessagesQueryDto,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.userId !== userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== 'ADMIN') {
        throw new ForbiddenException('Not ticket owner');
      }
    }

    const take = query.take || 50;
    const [data, total] = await Promise.all([
      this.prisma.ticketMessage.findMany({
        where: { ticketId },
        orderBy: { createdAt: 'asc' },
        take: take + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        include: { sender: true },
      }),
      this.prisma.ticketMessage.count({ where: { ticketId } }),
    ]);

    let nextCursor: string | null = null;
    if (data.length > take) {
      const nextItem = data.pop();
      nextCursor = nextItem?.id ?? null;
    }

    return { data, total, nextCursor };
  }

  async sendMessage(userId: string, ticketId: string, dto: SupportMessageDto) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.userId !== userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== 'ADMIN') {
        throw new ForbiddenException('Not ticket owner');
      }
    }

    const message = await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        senderId: userId,
        content: dto.content,
        attachments: dto.attachments ?? undefined,
      },
      include: { sender: true },
    });

    this.supportGateway.broadcastNewMessage(ticketId, message);

    return message;
  }

  // ================= ADMIN FUNCTIONS ================= //

  async adminGetTickets(query: AdminGetSupportTicketsQueryDto) {
    const where: any = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.category) {
      where.category = query.category;
    }
    if (query.userId) {
      where.userId = query.userId;
    }

    const take = query.take || 20;
    const [data, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        include: { user: true },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    let nextCursor: string | null = null;
    if (data.length > take) {
      const nextItem = data.pop();
      nextCursor = nextItem?.id ?? null;
    }

    return { data, total, nextCursor };
  }

  async adminJoinTicket(adminId: string, ticketId: string) {
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        assignedAdminId: adminId,
        status: 'IN_PROGRESS',
      },
    });

    return { success: true };
  }

  async adminUpdateTicket(
    adminId: string,
    ticketId: string,
    dto: UpdateSupportTicketDto,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        subject: dto.subject,
        title: dto.title,
        category: dto.category,
        priority: dto.priority,
        status: dto.status,
      },
    });
  }
}
