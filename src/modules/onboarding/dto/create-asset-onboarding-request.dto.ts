import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateAssetOnboardingRequestDto {
  @ApiProperty({ example: 'Căn hộ Vinhomes Smart City' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Asset description',
    example: '2PN, full nội thất...',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 'Hà Nội - Nam Từ Liêm' })
  @IsOptional()
  @IsString()
  location?: string;

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
}
