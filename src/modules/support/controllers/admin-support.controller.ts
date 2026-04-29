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
  AdminGetSupportTicketsQueryDto,
  UpdateSupportTicketDto,
} from '../dto/support.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../users/dto/roles.guard';
import { Roles } from '../../users/dto/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';

@ApiTags('Admin - Support')
@Controller('admin/support')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPPORT_STAFF')
export class AdminSupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  @ApiOperation({ summary: 'Admin list tickets' })
  async adminGetTickets(@Query() query: AdminGetSupportTicketsQueryDto) {
    return this.supportService.adminGetTickets(query);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Admin join ticket' })
  async adminJoinTicket(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.supportService.adminJoinTicket(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Admin update ticket' })
  async adminUpdateTicket(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSupportTicketDto,
  ) {
    return this.supportService.adminUpdateTicket(user.sub, id, dto);
  }
}
