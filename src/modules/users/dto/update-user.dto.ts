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
  @ApiPropertyOptional({ description: 'New avatar URL', format: 'uri' })
  @IsOptional()
  @IsUrl()
  avatar?: string;

  @ApiPropertyOptional({
    description: 'New username',
    minLength: 3,
    maxLength: 100,
    pattern: '^[A-Za-z0-9_]+$',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username?: string;

  @ApiPropertyOptional({ description: 'New gender', enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ description: 'New bio', minLength: 0, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bio?: string;

  @ApiPropertyOptional({ description: 'New cover avatar URL' })
  @IsOptional()
  @IsUrl()
  coverAvatar?: string;

  @ApiPropertyOptional({ description: 'New display name' })
  @IsOptional()
  @IsString()
  displayName?: string;
}

export class UpdateReferralDto {
  @ApiProperty({
    description: 'Reference code to set for the user',
    minLength: 1,
    maxLength: 50,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  referenceCode: string;
}
