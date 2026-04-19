import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateAssetDto {
  @ApiProperty({ description: 'On-chain token symbol (e.g., RWA-EST-01)' })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({
    description: 'Asset name (e.g., Vinhome Landmark 81 Apartment)',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Detailed asset description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Logo or asset image URL' })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiProperty({ description: 'Asset category ID' })
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({
    description: 'Total supply of this asset token',
    example: 10000,
  })
  @IsNumber()
  @Min(1)
  totalSupply: number;

  @ApiProperty({ description: 'Price per token (USDT)', example: 50 })
  @IsNumber()
  @Min(0)
  tokenPrice: number;

  @ApiPropertyOptional({
    description: 'Expected annual yield (APY %)',
    example: 8.5,
  })
  @IsOptional()
  @IsNumber()
  expectedApy?: number;

  @ApiPropertyOptional({
    description: 'Whether this asset is highlighted as hot',
  })
  @IsOptional()
  @IsBoolean()
  isHot?: boolean;
}
