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
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  take?: number = 20;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  skip?: number = 0;
}

export class QueryPostsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter posts by author id' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter posts tagged with an asset id' })
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiProperty({ description: 'Only return posts from followed authors' })
  @IsBoolean()
  @Type(() => Boolean)
  followingOnly: boolean;

  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @IsOptional()
  @IsEnum(['PENDING', 'APPROVED', 'REJECTED'])
  status?: string;

  @ApiPropertyOptional({ description: 'Search by content', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({
    enum: ['createdAt', 'viewCount', 'likeCount', 'commentCount'],
  })
  @IsOptional()
  @IsEnum(['createdAt', 'viewCount', 'likeCount', 'commentCount'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDir?: string = 'desc';
}

export class CommentDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 5000,
    description: 'Comment content',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}
