import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateSupportTicketDto,
  UpdateSupportTicketDto,
  SupportMessageDto,
  GetSupportTicketsQueryDto,
  AdminGetSupportTicketsQueryDto,
  GetMessagesQueryDto,
} from '../dto/support.dto';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async createTicket(userId: string, dto: CreateSupportTicketDto) {
    await Promise.resolve();
    void userId;
    void dto;
    // TODO: Create support ticket and initial message via Prisma
    return { success: true };
  }

  async getMyTickets(userId: string, query: GetSupportTicketsQueryDto) {
    await Promise.resolve();
    void userId;
    void query;
    return { data: [], total: 0 };
  }

  async getTicketDetail(userId: string, ticketId: string) {
    await Promise.resolve();
    void userId;
    void ticketId;
    return {};
  }

  async updateTicket(
    userId: string,
    ticketId: string,
    dto: UpdateSupportTicketDto,
  ) {
    await Promise.resolve();
    void userId;
    void ticketId;
    void dto;
    return { success: true };
  }

  async getTicketMessages(
    userId: string,
    ticketId: string,
    query: GetMessagesQueryDto,
  ) {
    await Promise.resolve();
    void userId;
    void ticketId;
    void query;
    return { data: [], total: 0, nextCursor: null };
  }

  async sendMessage(userId: string, ticketId: string, dto: SupportMessageDto) {
    await Promise.resolve();
    void userId;
    void ticketId;
    void dto;
    return { success: true };
  }

  // ================= ADMIN FUNCTIONS ================= //

  async adminGetTickets(query: AdminGetSupportTicketsQueryDto) {
    await Promise.resolve();
    void query;
    return { data: [], total: 0 };
  }

  async adminJoinTicket(adminId: string, ticketId: string) {
    await Promise.resolve();
    void adminId;
    void ticketId;
    return { success: true };
  }

  async adminUpdateTicket(
    adminId: string,
    ticketId: string,
    dto: UpdateSupportTicketDto,
  ) {
    await Promise.resolve();
    void adminId;
    void ticketId;
    void dto;
    return { success: true };
  }
}
