import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { OnboardingStatus } from '@prisma/client';

export class AdminUpdateOnboardingStatusDto {
  @ApiProperty({ enum: OnboardingStatus })
  @IsEnum(OnboardingStatus)
  status: OnboardingStatus;

  @ApiPropertyOptional({ description: 'Notes from appraisal/legal team' })
  @IsOptional()
  @IsString()
  adminNotes?: string;

  @ApiPropertyOptional({
    description: 'Appraised value after real-world appraisal',
    example: '3400000000',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'appraisedValue must be a decimal string' })
  appraisedValue?: string;
}

