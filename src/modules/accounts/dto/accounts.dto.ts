import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
  Matches,
  IsUrl,
  IsEnum,
} from 'class-validator';

export class UpdateAccountDto {
  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 100,
    pattern: '^[a-zA-Z0-9\\s_-]+$',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9\s_-]+$/)
  name?: string;

  @ApiPropertyOptional({
    format: 'uri',
    description: 'URL to user avatar image',
  })
  @IsOptional()
  @IsUrl()
  avatar?: string;

  @ApiPropertyOptional({
    description: 'Account leverage',
    minimum: 1,
    maximum: 200,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  leverage?: number;

  @ApiPropertyOptional({
    description: 'Account status, 0 = INACTIVE, 1 = ACTIVE, 2 = BANNED',
    enum: [0, 1, 2],
  })
  @IsOptional()
  @IsNumber()
  @IsEnum([0, 1, 2])
  status?: number;
}
