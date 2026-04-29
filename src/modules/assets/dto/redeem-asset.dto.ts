import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { RedemptionStatus } from '@prisma/client';

export class AdminUpdateRedemptionDto {
  @ApiProperty({ enum: RedemptionStatus })
  @IsEnum(RedemptionStatus)
  status: RedemptionStatus;

  @ApiPropertyOptional({
    description: 'Legal transfer documents (URLs, signed contracts, handover docs)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  legalTransferDocs?: string[];
}

