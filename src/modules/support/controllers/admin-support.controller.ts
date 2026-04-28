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
  AdminGetSupportTicketsQueryDto,
  UpdateSupportTicketDto,
} from '../dto/support.dto';
// TODO: Import JwtAuthGuard và AdminGuard

@ApiTags('Admin - Support')
@Controller('admin/support')
@ApiBearerAuth('accessToken')
// @UseGuards(JwtAuthGuard, AdminGuard)
export class AdminSupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  @ApiOperation({ summary: 'Admin list tickets' })
  async adminGetTickets(@Query() query: AdminGetSupportTicketsQueryDto) {
    return this.supportService.adminGetTickets(query);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Admin join ticket' })
  async adminJoinTicket(@Param('id') id: string) {
    const adminId = 'mock-admin-id';
    return this.supportService.adminJoinTicket(adminId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Admin update ticket' })
  async adminUpdateTicket(
    @Param('id') id: string,
    @Body() dto: UpdateSupportTicketDto,
  ) {
    const adminId = 'mock-admin-id';
    return this.supportService.adminUpdateTicket(adminId, id, dto);
  }
}
