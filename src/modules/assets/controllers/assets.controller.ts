import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssetsService } from '../services/assets.service';
import { CreateAssetDto } from '../dto/create-asset.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { RedeemService } from '../services/redeem.service';

@ApiTags('2. Assets (RWA)')
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly redeemService: RedeemService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Admin: Create a new asset and tokenize it on blockchain',
  })
  create(@Body() createAssetDto: CreateAssetDto) {
    return this.assetsService.create(createAssetDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get the list of RWA assets currently available for sale',
  })
  findAll() {
    return this.assetsService.findAll();
  }

  @Post(':id/redeem')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Request full redeem for an asset (requires full ownership).',
  })
  requestRedeem(
    @Param('id') assetId: string,
    @CurrentUser() user: JwtPayload | undefined,
    @Body('confirm') confirm?: boolean,
  ) {
    if (!user?.sub) {
      throw new BadRequestException('Invalid authenticated user payload.');
    }

    if (confirm !== true) {
      throw new BadRequestException(
        'Redeem request must be explicitly confirmed.',
      );
    }

    return this.redeemService.requestRedeem(user.sub, assetId);
  }
}
