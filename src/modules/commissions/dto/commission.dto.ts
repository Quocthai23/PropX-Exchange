import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommissionEvent } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsBoolean, Min, IsString, IsArray, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCommissionConfigDto {
  @ApiProperty({
    description: 'Commission rate as a decimal fraction. E.g. 0.20 = 20%, 0.05 = 5%.',
    example: 0.20,
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  commissionRate?: number;

  @ApiProperty({
    description: 'Whether this commission event configuration is active and will generate rewards.',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class GetRewardsQueryDto {
  @ApiPropertyOptional({
    description: 'Number of records to skip (offset pagination).',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  skip?: number;

  @ApiPropertyOptional({
    description: 'Number of reward records to return.',
    example: 10,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  take?: number;

  @ApiPropertyOptional({
    description: 'Filter rewards by commission event type.',
    enum: CommissionEvent,
    example: 'TRADING_FEE_REBATE',
  })
  @IsOptional()
  @IsEnum(CommissionEvent)
  eventType?: CommissionEvent;
}

export class ClaimRewardsDto {
  @ApiProperty({
    description: 'Array of commission reward IDs to claim in a single batch operation.',
    type: [String],
    example: ['reward_01J2XABCDEF', 'reward_01J2XGHIJKL'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  rewardIds: string[];
}
