import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  IsArray,
  ValidateNested,
  IsOptional,
  IsEnum,
  IsUrl,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MediaLinkDto {
  @ApiProperty({
    enum: ['image', 'video'],
    description: 'Media type attached to the post',
  })
  @IsEnum(['image', 'video'])
  type: string;

  @ApiProperty({
    format: 'uri',
    description: 'Public URL of the media resource',
  })
  @IsUrl()
  link: string;
}

export class CreatePostDto {
  @ApiProperty({ minLength: 1, maxLength: 10000, description: 'Post content' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(10000)
  content: string;

  @ApiPropertyOptional({
    type: [MediaLinkDto],
    maxItems: 10,
    description: 'Optional list of images/videos attached to the post',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MediaLinkDto)
  linksUrl?: MediaLinkDto[];

  @ApiPropertyOptional({
    type: [String],
    maxItems: 20,
    description: 'Optional list of tagged CFD asset identifiers',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  assetIds?: string[];

  @ApiPropertyOptional({ description: 'Optional post identifier to repost' })
  @IsOptional()
  @IsString()
  repostId?: string;
}
