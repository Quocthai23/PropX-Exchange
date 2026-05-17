import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  IsEnum,
  IsNumberString,
} from 'class-validator';
import { AssetType } from '@prisma/client';

export class CreateAssetOnboardingRequestDto {
  @ApiProperty({ example: 'Vinhomes Smart City Apartment' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Asset description',
    example: '2BR, fully furnished...',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 'Hanoi - Nam Tu Liem' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Array of image URLs' })
  @IsOptional()
  images?: any;

  @ApiPropertyOptional({ description: 'Total area' })
  @IsOptional()
  area?: number;

  @ApiPropertyOptional({ description: 'Zoning / Planning information' })
  @IsOptional()
  @IsString()
  zoning?: string;

  @ApiPropertyOptional({ description: 'Business model / What it does' })
  @IsOptional()
  @IsString()
  businessModel?: string;

  @ApiPropertyOptional({ description: 'Monthly benefits / Cashflow' })
  @IsOptional()
  @IsString()
  monthlyBenefits?: string;

  @ApiPropertyOptional({ description: 'Title deed / Sổ đỏ image URL' })
  @IsOptional()
  @IsString()
  titleDeedImage?: string;

  @ApiProperty({
    description: 'Expected appraisal value',
    example: '3500000000',
  })
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'estimatedValue must be a decimal string',
  })
  estimatedValue: string;

  @ApiProperty({
    description:
      'Array of URLs for legal document images (title deed, IDs, etc.)',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  legalDocuments: string[];

  @ApiPropertyOptional({ enum: AssetType, default: AssetType.ACCUMULATION })
  @IsOptional()
  @IsEnum(AssetType)
  assetType?: AssetType;

  @ApiPropertyOptional({
    description: 'Monthly interest rate for INTEREST_BEARING assets',
    example: '0.01',
  })
  @IsOptional()
  @IsNumberString()
  monthlyInterestRate?: string;

  @ApiPropertyOptional({
    description: 'Penalty rate for late payments',
    example: '0.05',
  })
  @IsOptional()
  @IsNumberString()
  penaltyRate?: string;

  @ApiPropertyOptional({
    description: 'Percentage of tokens retained by the issuer',
    example: '50',
  })
  @IsOptional()
  @IsNumberString()
  retainedTokenPercentage?: string;

  @ApiPropertyOptional({
    description: 'Percentage of tokens released to the market',
    example: '50',
  })
  @IsOptional()
  @IsNumberString()
  releasedTokenPercentage?: string;
}
