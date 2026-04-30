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
}
