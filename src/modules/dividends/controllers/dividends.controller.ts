import {
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DividendsService } from '../services/dividends.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';

@ApiTags('Dividends')
@Controller('dividends')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DividendsController {
  constructor(private readonly dividendsService: DividendsService) {}

  @Get('claimable')
  @ApiOperation({
    summary: 'Get list of unclaimed dividends (claimable)',
  })
  getClaimableDividends(@CurrentUser() user: JwtPayload) {
    return this.dividendsService.getClaimableDividends(user.sub);
  }

  @Post('claim/:distributionId')
  @ApiOperation({ summary: 'Claim a dividend to USDT balance' })
  claimDividend(
    @CurrentUser() user: JwtPayload,
    @Param('distributionId', ParseUUIDPipe) distributionId: string,
  ) {
    return this.dividendsService.claimDividend(user.sub, distributionId);
  }
}
