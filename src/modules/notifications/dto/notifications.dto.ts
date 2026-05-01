import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsBoolean,
} from 'class-validator';

export class GetNotificationsQueryDto {
  @ApiPropertyOptional({
    default: 20,
    minimum: 1,
    maximum: 100,
    description: 'Number of notifications to return per page.',
    example: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  take?: number = 20;

  @ApiPropertyOptional({
    default: 0,
    minimum: 0,
    description: 'Number of notifications to skip (offset pagination).',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  skip?: number = 0;

  @ApiPropertyOptional({
    description:
      'Filter by notification category. 0 = User activity, 1 = System announcements, 2 = Trading alerts.',
    enum: [0, 1, 2],
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsEnum([0, 1, 2])
  category?: number;

  @ApiPropertyOptional({
    description: 'Filter by read status. true = only read, false = only unread.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isRead?: boolean;
}
