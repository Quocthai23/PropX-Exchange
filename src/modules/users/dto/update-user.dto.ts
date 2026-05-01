import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  Matches,
  MinLength,
  MaxLength,
  IsUrl,
  IsEnum,
} from 'class-validator';
import { Gender } from './create-user.dto';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Publicly accessible URL of the new avatar image.',
    format: 'uri',
    example: 'https://cdn.example.com/avatars/user123.jpg',
  })
  @IsOptional()
  @IsUrl()
  avatar?: string;

  @ApiPropertyOptional({
    description: 'New username. Must be 3-100 characters: only letters, numbers, and underscores allowed.',
    minLength: 3,
    maxLength: 100,
    pattern: '^[A-Za-z0-9_]+$',
    example: 'john_doe_99',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username?: string;

  @ApiPropertyOptional({
    description: 'User gender selection.',
    enum: Gender,
    example: 'MALE',
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({
    description: 'Short bio or description displayed on the user profile. Maximum 255 characters.',
    minLength: 0,
    maxLength: 255,
    example: 'Crypto enthusiast & RWA investor. Building the future of finance.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bio?: string;

  @ApiPropertyOptional({
    description: 'Publicly accessible URL of the cover/banner image for the profile.',
    format: 'uri',
    example: 'https://cdn.example.com/covers/banner_123.jpg',
  })
  @IsOptional()
  @IsUrl()
  coverAvatar?: string;

  @ApiPropertyOptional({
    description: 'Display name shown on the profile (may differ from username).',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  displayName?: string;
}

export class UpdateReferralDto {
  @ApiProperty({
    description: 'Referral code to associate with this account. Can only be set once.',
    minLength: 1,
    maxLength: 50,
    example: 'REF-ABC123',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  referenceCode: string;
}
