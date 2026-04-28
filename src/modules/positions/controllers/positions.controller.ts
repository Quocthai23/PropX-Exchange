import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PositionsService } from '../services/positions.service';
import {
  ClosePositionDto,
  BulkClosePositionsDto,
  UpdatePositionDto,
  GetUserPositionsQueryDto,
} from '../dto/positions.dto';
// TODO: Import JwtAuthGuard và CurrentUser từ auth module
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
// import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Positions')
@Controller('positions')
@ApiBearerAuth('accessToken')
// @UseGuards(JwtAuthGuard)
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Get statistics about positions and orders of the account',
  })
  async getStats(@Query('accountId') accountId: string) {
    const userId = 'mock-user-id'; // Thay bằng user.sub
    return this.positionsService.getPositionsStats(userId, accountId);
  }

  @Post('bulk-close')
  @ApiOperation({ summary: 'Bulk close positions' })
  async bulkClose(@Body() dto: BulkClosePositionsDto) {
    const userId = 'mock-user-id';
    return this.positionsService.bulkClosePositions(userId, dto);
  }

  @Post(':positionId/close')
  @ApiOperation({ summary: 'Close position' })
  async closePosition(
    @Param('positionId') positionId: string,
    @Body() dto: ClosePositionDto,
  ) {
    const userId = 'mock-user-id';
    return this.positionsService.closePosition(userId, positionId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List positions' })
  async getPositions(@Query() query: GetUserPositionsQueryDto) {
    const userId = 'mock-user-id';
    return this.positionsService.getPositions(userId, query);
  }

  @Put(':positionId')
  @ApiOperation({ summary: 'Update position' })
  async updatePosition(
    @Param('positionId') positionId: string,
    @Body() dto: UpdatePositionDto,
  ) {
    const userId = 'mock-user-id';
    return this.positionsService.updatePosition(userId, positionId, dto);
  }
}
