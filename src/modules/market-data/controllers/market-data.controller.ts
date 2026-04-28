import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  MarketDataService,
  CandlePoint,
} from '../services/market-data.service';
import { ExternalValuationService } from '../services/external-valuation.service';
import { GetCandlesDto, GetValuationHistoryDto } from '../dto/market-data.dto';

@ApiTags('3. Market Data (Charts)')
@Controller('market-data')
export class MarketDataController {
  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly externalValuationService: ExternalValuationService,
  ) {}

  @Get('candles')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: 'Returns array of OHLCV candles wrapped in data property',
  })
  @ApiOperation({ summary: 'Get OHLC candle data for Lightweight Charts' })
  async getCandles(@Query() query: GetCandlesDto): Promise<CandlePoint[]> {
    return this.marketDataService.getCandles(
      query.assetId,
      query.resolution,
      new Date(query.from),
      new Date(query.to),
    );
  }

  @Get('valuation/history')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: 'Returns valuation history data',
  })
  @ApiOperation({
    summary: 'Get external valuation snapshots from crawl providers',
  })
  async getValuationHistory(@Query() query: GetValuationHistoryDto) {
    return this.externalValuationService.getHistory({
      assetId: query.assetId,
      areaCode: query.areaCode,
      limit: query.limit ?? 30,
    });
  }
}
