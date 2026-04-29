import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupportService } from '../services/support.service';
import {
  CreateSupportTicketDto,
  UpdateSupportTicketDto,
  SupportMessageDto,
  GetSupportTicketsQueryDto,
  GetMessagesQueryDto,
} from '../dto/support.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';

@ApiTags('Support')
@Controller('support-tickets')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  @ApiOperation({ summary: 'Create support ticket' })
  async createTicket(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSupportTicketDto,
  ) {
    return this.supportService.createTicket(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my support tickets' })
  async getMyTickets(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetSupportTicketsQueryDto,
  ) {
    return this.supportService.getMyTickets(user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket detail' })
  async getTicketDetail(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.supportService.getTicketDetail(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update support ticket' })
  async updateTicket(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSupportTicketDto,
  ) {
    return this.supportService.updateTicket(user.sub, id, dto);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Load ticket messages' })
  async getMessages(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.supportService.getTicketMessages(user.sub, id, query);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send message' })
  async sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SupportMessageDto,
  ) {
    return this.supportService.sendMessage(user.sub, id, dto);
  }
}
