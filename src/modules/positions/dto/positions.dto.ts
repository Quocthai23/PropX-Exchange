import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  Matches,
  IsArray,
  ArrayMinSize,
  IsEnum,
} from 'class-validator';

export class ClosePositionDto {
  @ApiProperty({
    description: 'Trading account ID',
    pattern: '^(real|demo)_[0-9]{8}$',
  })
  @IsString()
  @Matches(/^(real|demo)_[0-9]{8}$/)
  accountId: string;

  @ApiProperty({ description: 'Close quantity (partial/full)' })
  @IsNotEmpty()
  quantity: number | string;
}

export class BulkClosePositionsDto {
  @ApiProperty({
    description: 'Trading account ID',
    pattern: '^(real|demo)_[0-9]{8}$',
  })
  @IsString()
  @Matches(/^(real|demo)_[0-9]{8}$/)
  accountId: string;

  @ApiProperty({
    description: 'Array of position IDs to close',
    type: [String],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  positionIds: string[];
}

export class UpdatePositionDto {
  @ApiProperty({
    description: 'Trading account ID',
    pattern: '^(real|demo)_[0-9]{8}$',
  })
  @IsString()
  @Matches(/^(real|demo)_[0-9]{8}$/)
  accountId: string;

  @ApiPropertyOptional({
    description: 'New stop loss price. Optional, set to null to remove',
  })
  @IsOptional()
  stopLossPrice?: number | string | null;

  @ApiPropertyOptional({
    description: 'New take profit price. Optional, set to null to remove',
  })
  @IsOptional()
  takeProfitPrice?: number | string | null;
}

export class GetPositionsQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  take?: number = 20;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  skip?: number = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  symbol?: string;

  @ApiPropertyOptional({
    description: 'Order side: 0 for buy, 1 for sell',
    enum: [0, 1],
  })
  @IsOptional()
  @Type(() => Number)
  @IsEnum([0, 1])
  side?: number;

  @ApiPropertyOptional({
    enum: ['openedAt', 'closedAt', 'quantity', 'symbol', 'side', 'realizedPnl'],
    default: 'openedAt',
  })
  @IsOptional()
  @IsEnum(['openedAt', 'closedAt', 'quantity', 'symbol', 'side', 'realizedPnl'])
  sortBy?: string = 'openedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDir?: string = 'desc';

  @ApiPropertyOptional({
    description: 'Array of position statuses',
    type: [Number],
  })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map(Number) : [Number(value)],
  )
  status?: number[];

  @ApiPropertyOptional({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  @ApiPropertyOptional({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;
}

export class GetUserPositionsQueryDto extends GetPositionsQueryDto {
  @ApiProperty({
    description: 'Trading account ID',
    pattern: '^(real|demo)_[0-9]{8}$',
  })
  @IsString()
  @Matches(/^(real|demo)_[0-9]{8}$/)
  accountId: string;
}

export class GetAdminPositionsQueryDto extends GetPositionsQueryDto {
  @ApiPropertyOptional({
    description: 'Optional trading account ID',
    pattern: '^(real|demo)_[0-9]{8}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(real|demo)_[0-9]{8}$/)
  accountId?: string;
}
