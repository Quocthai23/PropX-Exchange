import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsEnum,
} from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    default: 20,
    minimum: 1,
    maximum: 100,
    description: 'Number of records to return per page.',
    example: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  take?: number = 20;

  @ApiPropertyOptional({
    default: 0,
    minimum: 0,
    description: 'Number of records to skip (offset-based pagination).',
    example: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  skip?: number = 0;
}

export class QueryPostsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter posts by a specific author user ID.',
    example: 'usr_01J2XABCDEF',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter posts tagged with a specific asset ID.',
    example: 'asset_01J2XAAPL',
  })
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiProperty({
    description: 'When true, returns only posts from authors the current user follows.',
    example: false,
  })
  @IsBoolean()
  @Type(() => Boolean)
  followingOnly: boolean;

  @ApiPropertyOptional({
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    description: 'Filter posts by moderation status.',
    example: 'APPROVED',
  })
  @IsOptional()
  @IsEnum(['PENDING', 'APPROVED', 'REJECTED'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Full-text search term to match against post content.',
    maxLength: 255,
    example: 'bullish AAPL',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({
    enum: ['createdAt', 'viewCount', 'likeCount', 'commentCount'],
    description: 'Field to sort results by.',
    example: 'createdAt',
  })
  @IsOptional()
  @IsEnum(['createdAt', 'viewCount', 'likeCount', 'commentCount'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    description: 'Sort direction.',
    example: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDir?: string = 'desc';
}

export class CommentDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 5000,
    description: 'Comment text content. Must be between 1 and 5000 characters.',
    example: 'Great analysis! I agree with your take on the technicals.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}
