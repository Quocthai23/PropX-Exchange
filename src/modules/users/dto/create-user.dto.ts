import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum RelationAction {
  FOLLOW = 'follow',
  UNFOLLOW = 'unfollow',
  BLOCK = 'block',
  UNBLOCK = 'unblock',
}

export class UserPaginationDto {
  @ApiPropertyOptional({
    description: 'Number of items to take (max 100)',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;

  @ApiPropertyOptional({
    description: 'Number of items to skip',
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;
}

export class GetRelationsDto extends UserPaginationDto {
  @ApiProperty({
    description: 'Relation type to list',
    enum: ['block', 'followings', 'follower'],
  })
  @IsString()
  @IsEnum(['block', 'followings', 'follower'])
  relation: string;
}

export class SuggestUsersDto extends UserPaginationDto {}

export class ToggleFavoriteAssetDto {
  @ApiProperty({ description: 'Asset identifier to toggle favorite' })
  @IsString()
  assetId: string;
}

export class UpsertRelationDto {
  @ApiProperty({
    description: 'Relation action to apply to the target user',
    enum: RelationAction,
  })
  @IsEnum(RelationAction)
  action: RelationAction;
}
