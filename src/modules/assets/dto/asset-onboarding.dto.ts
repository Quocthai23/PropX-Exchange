import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class SubmitAssetOnboardingDto {
  @ApiProperty({
    description:
      'Legal document URLs (title deed, legal docs, custody authorization)',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  legalDocumentUrls: string[];

  @ApiPropertyOptional({ description: 'Optional note from asset owner' })
  @IsOptional()
  @IsString()
  ownerNote?: string;
}

export class ReviewAssetOnboardingDto {
  @ApiProperty({ description: 'Approve or reject due diligence result' })
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional({
    description: 'SPV legal entity after custody transfer',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  spvEntity?: string;

  @ApiPropertyOptional({ description: 'Review note' })
  @IsOptional()
  @IsString()
  reason?: string;
}
