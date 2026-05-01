import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsUrl,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsBoolean,
  Matches,
  IsNumberString,
} from 'class-validator';

export class UpdateAssetDto {
  @ApiPropertyOptional({
    description: 'Ticker symbol used to identify the asset (e.g. EURUSD, AAPL, GOLD).',
    example: 'EURUSD',
    minLength: 1,
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  symbol?: string;

  @ApiPropertyOptional({
    description: 'Symbol used to fetch real-time price from the data provider (may differ from display symbol).',
    example: 'EUR/USD',
    minLength: 1,
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  priceSourceSymbol?: string;

  @ApiPropertyOptional({
    description: 'Human-readable display name of the asset shown in the UI.',
    example: 'Euro / US Dollar',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'ID of the asset category (e.g. Forex, Crypto, Stocks, RWA).',
    example: 'cat_forex_01',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Publicly accessible URL to the asset logo/icon image.',
    format: 'uri',
    example: 'https://cdn.example.com/logos/eur_usd.png',
  })
  @IsOptional()
  @IsUrl()
  logo?: string;

  @ApiPropertyOptional({
    description: 'Number of decimal places for displaying the asset price (0-20).',
    example: 5,
    minimum: 0,
    maximum: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  digit?: number;

  @ApiPropertyOptional({
    description: 'Asset spread type: floating or fixed',
    enum: ['floating', 'fixed'],
  })
  @IsOptional()
  @IsEnum(['floating', 'fixed'])
  spread?: string;

  @ApiPropertyOptional({ description: 'Currency used for margin' })
  @IsOptional()
  @IsString()
  marginCurrency?: string;

  @ApiPropertyOptional({ description: 'Currency used for profit and PnL' })
  @IsOptional()
  @IsString()
  profitCurrency?: string;

  @ApiPropertyOptional({
    description: 'Chart mode: 0 = Bid Price, 1 = Ask Price',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  chartMode?: number;

  @ApiPropertyOptional({
    description: 'Trade mode: 0 = Full Access, 1 = Only Buy, 2 = Only Sell',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  trade?: number;

  @ApiPropertyOptional({ description: 'Whether the asset is tradable' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'Reference price (NAV) maintained by admin/independent valuation report',
  })
  @IsOptional()
  @IsNumberString()
  referencePrice?: string;

  @ApiPropertyOptional({
    description:
      'Allowed order price band around NAV (e.g. 0.1 = +/-10%, 0.15 = +/-15%)',
  })
  @IsOptional()
  @IsNumberString()
  priceBandPercentage?: string;

  // Financial/Trading configuration (Using strings for precise Decimals)
  @ApiPropertyOptional({
    description: 'Minimum allowed trade volume (lot size) as a decimal string.',
    example: '0.01',
    pattern: '^-?\\d+(\\.\\d+)?$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  minTradeSize?: string;
  @ApiPropertyOptional({
    description: 'Maximum allowed trade volume (lot size) as a decimal string.',
    example: '100.00',
    pattern: '^-?\\d+(\\.\\d+)?$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  maxTradeSize?: string;
  @ApiPropertyOptional({
    description: 'Step increment for trade volume (e.g. 0.01 means orders must be multiples of 0.01).',
    example: '0.01',
    pattern: '^-?\\d+(\\.\\d+)?$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  volumeStep?: string;
  @ApiPropertyOptional({
    description: 'Pip size for the asset (e.g. 0.0001 for EUR/USD).',
    example: '0.0001',
    pattern: '^-?\\d+(\\.\\d+)?$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  pipSize?: string;
  @ApiPropertyOptional({
    description: 'Maximum allowed price slippage in pips during order execution.',
    example: '3',
    pattern: '^-?\\d+(\\.\\d+)?$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  slippage?: string;
  @ApiPropertyOptional({ description: 'Swap calculation type (e.g. Points, Percent, Currency).', example: 'Points' }) @IsOptional() @IsString() swapType?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  swapLong?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  swapShort?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  marginMultiplier?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  contractSize?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  tradingCommissionPerLot?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  ibCommissionPerLot?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  rebatePerLot?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  minSpread?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  spreadMultiplier?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  tpslSpreadMultiplier?: string;

  @ApiPropertyOptional({
    description: 'Optional per-weekday swap rate configuration',
  })
  @IsOptional()
  swapRates?: any;
}
