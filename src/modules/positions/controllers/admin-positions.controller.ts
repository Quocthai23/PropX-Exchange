import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PositionsService } from '../services/positions.service';
import { GetAdminPositionsQueryDto } from '../dto/positions.dto';
// TODO: Import JwtAuthGuard và AdminGuard
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
// import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin - User')
@Controller('admin/positions')
@ApiBearerAuth('accessToken')
// @UseGuards(JwtAuthGuard, AdminGuard)
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
