import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({
    description: 'Asset ID to trade',
    example: 'asset_01J2XABCDEF123',
  })
  @IsString()
  assetId: string;

  @ApiProperty({
    description: 'Idempotency key to prevent duplicated order creation',
    example: 'idem_order_20260427_001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey: string;

  @ApiProperty({
    description: 'Order side',
    enum: ['BUY', 'SELL'],
    example: 'BUY',
  })
  @IsEnum(['BUY', 'SELL'])
  side: 'BUY' | 'SELL';

  @ApiProperty({ description: 'Order price per unit in USDT', example: 50.25 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  price: number;

  @ApiProperty({ description: 'Order quantity', example: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantity: number;
}
