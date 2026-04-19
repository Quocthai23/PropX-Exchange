import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  IsDateString,
  IsOptional,
} from 'class-validator';

export class CreateDistributionDto {
  @ApiProperty({ description: 'RWA asset ID' })
  @IsString()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty({ description: 'Total USDT to distribute (e.g., 10000)' })
  @IsNumber()
  @Min(0.01)
  totalAmount: number;

  @ApiPropertyOptional({
    description:
      'Snapshot date/time. Defaults to immediate execution if omitted.',
  })
  @IsOptional()
  @IsDateString()
  snapshotDate?: string;
}
