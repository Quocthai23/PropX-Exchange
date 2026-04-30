import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommissionEvent } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsBoolean, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCommissionConfigDto {
  @ApiProperty({ description: 'The commission rate, e.g., 0.20 for 20%', example: 0.20, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  commissionRate?: number;

  @ApiProperty({ description: 'Is the commission event active', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class GetRewardsQueryDto {
  @ApiPropertyOptional({ description: 'Number of records to skip', example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  skip?: number;

  @ApiPropertyOptional({ description: 'Number of records to take', example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  take?: number;

  @ApiPropertyOptional({ description: 'Filter by event type', enum: CommissionEvent })
  @IsOptional()
  @IsEnum(CommissionEvent)
  eventType?: CommissionEvent;
}
