import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CandlePoint, MarketDataService } from './market-data.service';
import { GetCandlesDto } from './dto/get-candles.dto';
import { ExternalValuationService } from './external-valuation.service';
import { GetValuationHistoryDto } from './dto/get-valuation-history.dto';

@ApiTags('3. Market Data (Charts)')
@Controller('market-data')
export class MarketDataController {
  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly externalValuationService: ExternalValuationService,
  ) {}

  @Get('candles')
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
