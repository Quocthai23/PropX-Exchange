import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DividendsService } from '../services/dividends.service';
import { CreateDistributionDto } from '../dto/create-distribution.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../users/dto/roles.guard';
import { Roles } from '../../users/dto/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';

@ApiTags('Admin - Dividends')
@Controller('admin/dividends')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth('accessToken')
export class AdminDividendsController {
  constructor(private readonly dividendsService: DividendsService) {}

  @Post('distribute')
  @ApiOperation({
    summary: 'Admin: Create a new dividend distribution with snapshot logic',
  })
  createDistribution(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDistributionDto,
  ) {
    return this.dividendsService.createDistribution(user.sub, dto);
  }
}
