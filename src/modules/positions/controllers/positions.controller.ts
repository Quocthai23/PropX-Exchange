import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PositionsService } from '../services/positions.service';
import {
  ClosePositionDto,
  BulkClosePositionsDto,
  UpdatePositionDto,
  GetUserPositionsQueryDto,
} from '../dto/positions.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';

@ApiTags('Positions')
@Controller('positions')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Get statistics about positions and orders of the account',
  })
  async getStats(
    @CurrentUser() user: JwtPayload,
    @Query('accountId') accountId: string,
  ) {
    return this.positionsService.getPositionsStats(user.sub, accountId);
  }

  @Post('bulk-close')
  @ApiOperation({ summary: 'Bulk close positions' })
  async bulkClose(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BulkClosePositionsDto,
  ) {
    return this.positionsService.bulkClosePositions(user.sub, dto);
  }

  @Post(':positionId/close')
  @ApiOperation({ summary: 'Close position' })
  async closePosition(
    @CurrentUser() user: JwtPayload,
    @Param('positionId') positionId: string,
    @Body() dto: ClosePositionDto,
  ) {
    return this.positionsService.closePosition(user.sub, positionId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List positions' })
  async getPositions(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetUserPositionsQueryDto,
  ) {
    return this.positionsService.getPositions(user.sub, query);
  }

  @Put(':positionId')
  @ApiOperation({ summary: 'Update position' })
  async updatePosition(
    @CurrentUser() user: JwtPayload,
    @Param('positionId') positionId: string,
    @Body() dto: UpdatePositionDto,
  ) {
    return this.positionsService.updatePosition(user.sub, positionId, dto);
  }
}
