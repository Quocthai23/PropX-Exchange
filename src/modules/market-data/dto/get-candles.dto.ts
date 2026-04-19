import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsString } from 'class-validator';

const candleResolutions = ['1m', '5m', '15m', '30m', '1h', '1d'] as const;

export class GetCandlesDto {
  @ApiProperty({ description: 'Asset ID' })
  @IsString()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty({
    description: 'Candle time resolution',
    example: '15m',
    enum: candleResolutions,
  })
  @IsEnum(candleResolutions)
  resolution: (typeof candleResolutions)[number];

  @ApiProperty({
    description: 'Start date (ISO String)',
    example: '2023-01-01T00:00:00Z',
  })
  @IsDateString()
  from: string;

  @ApiProperty({
    description: 'End date (ISO String)',
    example: '2023-12-31T23:59:59Z',
  })
  @IsDateString()
  to: string;
}
