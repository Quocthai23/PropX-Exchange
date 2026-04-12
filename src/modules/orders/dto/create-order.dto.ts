import { IsEnum, IsNumber, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { OrderSide } from '@prisma/client';

export class CreateOrderDto {
  @IsString()
  assetId: string;

  @IsEnum(['BUY', 'SELL'])
  side: OrderSide;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  price: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantity: number;
}
