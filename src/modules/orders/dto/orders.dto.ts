import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  Matches,
  IsArray,
  ArrayMinSize,
  IsEnum,
  IsBoolean,
} from 'class-validator';

export class BulkCancelOrdersDto {
  @ApiProperty({
    description: 'Trading account ID',
    pattern: '^(real|demo)_[0-9]{8}$',
  })
  @IsString()
  @Matches(/^(real|demo)_[0-9]{8}$/)
  accountId: string;

  @ApiProperty({
    description: 'Array of order IDs to cancel',
    type: [String],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderIds: string[];
}

export class UpdateOrderDto {
  @ApiProperty({
    description: 'Trading account ID',
    pattern: '^(real|demo)_[0-9]{8}$',
  })
  @IsString()
  @Matches(/^(real|demo)_[0-9]{8}$/)
  accountId: string;

  @ApiPropertyOptional({
    description:
      'Set to true to cancel the order. If true, other fields are ignored',
  })
  @IsOptional()
  @IsBoolean()
  cancel?: boolean;

  @ApiPropertyOptional({
    description: 'New limit/stop price. Only applicable for non-MARKET orders',
  })
  @IsOptional()
  price?: number | string;

  @ApiPropertyOptional({
    description: 'New stop loss price. Optional, set to null to remove',
  })
  @IsOptional()
  stopLossPrice?: number | string | null;

  @ApiPropertyOptional({
    description: 'New take profit price. Optional, set to null to remove',
  })
  @IsOptional()
  takeProfitPrice?: number | string | null;
}

export class GetOrdersQueryDto {
  @ApiPropertyOptional({ description: 'Cursor for pagination (position ID)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  take?: number = 20;

  @ApiProperty({
    description: 'Trading account ID',
    pattern: '^(real|demo)_[0-9]{8}$',
  })
  @IsString()
  @Matches(/^(real|demo)_[0-9]{8}$/)
  accountId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  symbol?: string;

  @ApiPropertyOptional({
    description: 'Order side: 0 for long, 1 for short',
    enum: [0, 1],
  })
  @IsOptional()
  @Type(() => Number)
  @IsEnum([0, 1])
  side?: number;

  @ApiPropertyOptional({
    description: 'Order type: 0 for market, 1 for limit, 2 for stop',
    enum: [0, 1, 2],
  })
  @IsOptional()
  @Type(() => Number)
  @IsEnum([0, 1, 2])
  orderType?: number;

  @ApiPropertyOptional({
    description: 'Array of order statuses',
    type: [Number],
  })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map(Number) : [Number(value)],
  )
  status?: number[];

  @ApiPropertyOptional({
    enum: ['createdAt', 'quantity', 'orderType', 'symbol', 'side'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsEnum(['createdAt', 'quantity', 'orderType', 'symbol', 'side'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDir?: string = 'desc';

  @ApiPropertyOptional({
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
    description: 'Start date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  @ApiPropertyOptional({
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
    description: 'End date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Trading symbol, e.g. "XAUUSD"' })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({ description: 'Order side: 0 for long, 1 for short' })
  @Type(() => Number)
  @IsNumber()
  side: number;

  @ApiPropertyOptional({ description: 'Stop loss price. Optional' })
  @IsOptional()
  stopLossPrice?: number | string | null;

  @ApiPropertyOptional({ description: 'Take profit price. Optional' })
  @IsOptional()
  takeProfitPrice?: number | string | null;

  @ApiProperty({
    description: 'Order quantity. Must be within asset min/max trade size',
  })
  @IsNotEmpty()
  quantity: number | string;

  @ApiProperty({
    description: 'Trading account ID',
    pattern: '^(real|demo)_[0-9]{8}$',
  })
  @IsString()
  @Matches(/^(real|demo)_[0-9]{8}$/)
  accountId: string;

  @ApiProperty({
    description: 'Order type: 0 for market, 1 for limit, 2 for stop',
  })
  @Type(() => Number)
  @IsNumber()
  orderType: number;

  @ApiPropertyOptional({
    description:
      'Limit/Stop price (required for LIMIT/STOP orders, ignored for MARKET)',
  })
  @IsOptional()
  price?: number | string;
}
