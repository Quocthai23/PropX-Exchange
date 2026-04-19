import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CandlePoint, MarketDataService } from './market-data.service';
import { GetCandlesDto } from './dto/get-candles.dto';

@ApiTags('3. Market Data (Charts)')
@Controller('market-data')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

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
}
