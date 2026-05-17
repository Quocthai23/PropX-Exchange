import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  Matches,
  IsArray,
  ArrayMinSize,
  IsEnum,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { $Enums } from '@prisma/client';

export class BulkCancelOrdersDto {
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
  @ApiPropertyOptional({
    description:
      'Set to true to cancel the order. If true, other fields are ignored',
  })
  @IsOptional()
  @IsBoolean()
  cancel?: boolean;

  @ApiPropertyOptional({
    description: 'Trading account identifier',
  })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional({
    description: 'New limit/stop price. Only applicable for non-MARKET orders',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/)
  price?: string;
}

export class GetOrdersQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;

  @ApiPropertyOptional({ description: 'Cursor for pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Order side',
    enum: $Enums.OrderSide,
  })
  @IsOptional()
  @IsEnum($Enums.OrderSide)
  side?: $Enums.OrderSide;

  @ApiPropertyOptional({
    description: 'Order status',
    enum: $Enums.OrderStatus,
  })
  @IsOptional()
  @IsEnum($Enums.OrderStatus)
  status?: $Enums.OrderStatus;

  @ApiPropertyOptional({ description: 'Asset ID' })
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiPropertyOptional({ description: 'Trading account ID' })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional({
    description: 'Order type',
    enum: $Enums.OrderType,
  })
  @IsOptional()
  @IsEnum($Enums.OrderType)
  orderType?: $Enums.OrderType;

  @ApiPropertyOptional({ description: 'Sort field (e.g. createdAt, price)' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsOptional()
  @Type(() => Date)
  fromDate?: Date;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsOptional()
  @Type(() => Date)
  toDate?: Date;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Asset ID' })
  @IsString()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty({ description: 'Order side', enum: $Enums.OrderSide })
  @IsEnum($Enums.OrderSide)
  side: $Enums.OrderSide;

  @ApiProperty({ description: 'Order type', enum: $Enums.OrderType })
  @IsEnum($Enums.OrderType)
  type: $Enums.OrderType;

  @ApiProperty({ description: 'Order quantity' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/)
  quantity: string;

  @ApiPropertyOptional({
    description: 'Limit price (required for LIMIT orders, ignored for MARKET)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/)
  price?: string;

  @ApiPropertyOptional({
    description: 'Client-generated UUID to prevent duplicate submissions',
  })
  @IsOptional()
  @IsUUID('4')
  idempotencyKey?: string;

  @ApiPropertyOptional({
    description: 'Max total cost for MARKET BUY orders to lock funds safely.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/)
  maxTotalCost?: string;
  @ApiPropertyOptional({
    description: 'Trading account identifier',
  })
  @IsOptional()
  @IsString()
  accountId?: string;
}
