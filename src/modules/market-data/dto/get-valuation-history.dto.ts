import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetValuationHistoryDto {
  @ApiPropertyOptional({ description: 'Optional asset ID filter' })
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiPropertyOptional({ description: 'Optional area code filter' })
  @IsOptional()
  @IsString()
  areaCode?: string;

  @ApiPropertyOptional({
    description: 'Maximum snapshots returned',
    default: 30,
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  limit?: number;
}
