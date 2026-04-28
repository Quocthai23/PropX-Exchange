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
} from 'class-validator';

export class UpdateAssetDto {
  @ApiPropertyOptional({ description: 'Asset symbol (e.g. EURUSD)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  symbol?: string;

  @ApiPropertyOptional({ description: 'Price source symbol' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  priceSourceSymbol?: string;

  @ApiPropertyOptional({ description: 'Asset display name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Asset category identifier' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Asset logo URL', format: 'uri' })
  @IsOptional()
  @IsUrl()
  logo?: string;

  @ApiPropertyOptional({ description: 'Decimal digits for price formatting' })
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

  @ApiPropertyOptional({ description: 'Maximum allowed leverage' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxLeverage?: number;

  @ApiPropertyOptional({ description: 'Whether the asset is tradable' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Financial/Trading configuration (Using strings for precise Decimals)
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  minTradeSize?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  maxTradeSize?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  volumeStep?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  pipSize?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  slippage?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() swapType?: string;
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
