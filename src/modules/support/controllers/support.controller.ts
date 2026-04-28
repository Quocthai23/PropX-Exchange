import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
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
// TODO: Import JwtAuthGuard và CurrentUser từ auth module

@ApiTags('Support')
@Controller('support-tickets')
@ApiBearerAuth('accessToken')
// @UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  @ApiOperation({ summary: 'Create support ticket' })
  async createTicket(@Body() dto: CreateSupportTicketDto) {
    const userId = 'mock-user-id';
    return this.supportService.createTicket(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my support tickets' })
  async getMyTickets(@Query() query: GetSupportTicketsQueryDto) {
    const userId = 'mock-user-id';
    return this.supportService.getMyTickets(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket detail' })
  async getTicketDetail(@Param('id') id: string) {
    const userId = 'mock-user-id';
    return this.supportService.getTicketDetail(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update support ticket' })
  async updateTicket(
    @Param('id') id: string,
    @Body() dto: UpdateSupportTicketDto,
  ) {
    const userId = 'mock-user-id';
    return this.supportService.updateTicket(userId, id, dto);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Load ticket messages' })
  async getMessages(
    @Param('id') id: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    const userId = 'mock-user-id';
    return this.supportService.getTicketMessages(userId, id, query);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send message' })
  async sendMessage(@Param('id') id: string, @Body() dto: SupportMessageDto) {
    const userId = 'mock-user-id';
    return this.supportService.sendMessage(userId, id, dto);
  }
}
