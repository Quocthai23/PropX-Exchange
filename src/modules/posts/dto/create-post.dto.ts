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
    description: 'Media type attached to the post.',
    example: 'image',
  })
  @IsEnum(['image', 'video'])
  type: string;

  @ApiProperty({
    format: 'uri',
    description: 'Publicly accessible URL of the media resource (image or video).',
    example: 'https://cdn.example.com/posts/photo_001.jpg',
  })
  @IsUrl()
  link: string;
}

export class CreatePostDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 10000,
    description: 'Main text content of the post. Supports plain text up to 10,000 characters.',
    example: 'Just opened a long position on $AAPL — bullish on earnings! 🚀',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(10000)
  content: string;

  @ApiPropertyOptional({
    type: [MediaLinkDto],
    maxItems: 10,
    description: 'Optional list of image or video attachments. Maximum 10 items.',
    example: [
      { type: 'image', link: 'https://cdn.example.com/img/chart.png' },
    ],
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
    description: 'Optional list of CFD/RWA asset identifiers to tag in the post.',
    example: ['asset_01J2XAAPL', 'asset_01J2XTSLA'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  assetIds?: string[];

  @ApiPropertyOptional({
    description: 'Optional ID of an existing post to repost/quote.',
    example: 'post_01J2XABCDEF',
  })
  @IsOptional()
  @IsString()
  repostId?: string;
}
