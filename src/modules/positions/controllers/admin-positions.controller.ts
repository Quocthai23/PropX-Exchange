import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PositionsService } from '../services/positions.service';
import { GetAdminPositionsQueryDto } from '../dto/positions.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../users/dto/roles.guard';
import { Roles } from '../../users/dto/roles.decorator';

@ApiTags('Admin - User')
@Controller('admin/positions')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminPositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get positions',
    description:
      'Get list of positions for an account with filters and pagination',
  })
  async getAdminPositions(@Query() query: GetAdminPositionsQueryDto) {
    return this.positionsService.getAdminPositions(query);
  }
}
