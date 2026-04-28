import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsDateString,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GetCandlesDto {
  @ApiProperty({ description: 'Unique identifier of the Asset' })
  @IsString()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty({
    enum: ['1m', '5m', '15m', '1h', '4h', '1d', '1w'],
    description: 'Candlestick resolution/timeframe',
  })
  @IsEnum(['1m', '5m', '15m', '1h', '4h', '1d', '1w'])
  resolution: string;

  @ApiProperty({
    description: 'Start time in ISO8601 format',
    format: 'date-time',
  })
  @IsDateString()
  from: string;

  @ApiProperty({
    description: 'End time in ISO8601 format',
    format: 'date-time',
  })
  @IsDateString()
  to: string;
}

export class GetValuationHistoryDto {
  @ApiProperty({ description: 'Unique identifier of the Asset' })
  @IsString()
  @IsNotEmpty()
  assetId: string;

  @ApiPropertyOptional({
    description: 'Area code for specific regional valuation',
  })
  @IsOptional()
  @IsString()
  areaCode?: string;

  @ApiPropertyOptional({
    description: 'Number of items to take (max 100)',
    default: 30,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 30;
}
