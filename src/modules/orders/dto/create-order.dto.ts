import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderDto {
  @IsString()
  assetId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey: string;

  @IsEnum(['BUY', 'SELL'])
  side: 'BUY' | 'SELL';

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  price: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantity: number;
}
