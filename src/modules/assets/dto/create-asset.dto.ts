import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAssetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]{2,10}$/)
  symbol: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  location: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  totalValuation: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(100)
  apy: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  tokenPrice: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsUrl(
    { require_protocol: true },
    { each: true, message: 'Each image must be a valid URL.' },
  )
  images: string[];
}
