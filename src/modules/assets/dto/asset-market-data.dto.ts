import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsDate, IsString } from 'class-validator';

export class AssetMarketDataDto {
    @ApiPropertyOptional({ description: 'Best sell price (ask) in USDT', example: 50.5 })
    @IsOptional()
    @IsNumber()
    sellPrice?: number;

    @ApiPropertyOptional({ description: 'Best buy price (bid) in USDT', example: 50.0 })
    @IsOptional()
    @IsNumber()
    buyPrice?: number;

    @ApiPropertyOptional({ description: 'Spread between ask and bid', example: 0.5 })
    @IsOptional()
    @IsNumber()
    spread?: number;

    @ApiPropertyOptional({ description: 'Traded volume in the last period', example: 1200 })
    @IsOptional()
    @IsNumber()
    volume?: number;

    @ApiPropertyOptional({ description: 'Sell percentage (market sell pressure)', example: 62.5 })
    @IsOptional()
    @IsNumber()
    sellPercent?: number;

    @ApiPropertyOptional({ description: 'Buy percentage (market buy pressure)', example: 37.5 })
    @IsOptional()
    @IsNumber()
    buyPercent?: number;

    @ApiPropertyOptional({ description: 'Change percent versus previous period', example: -1.25 })
    @IsOptional()
    @IsNumber()
    chgPercent?: number;

    @ApiPropertyOptional({ description: 'Lowest price in the period', example: 49.0 })
    @IsOptional()
    @IsNumber()
    low?: number;

    @ApiPropertyOptional({ description: 'Timestamp of the last update' })
    @IsOptional()
    @IsDate()
    lastUpdated?: Date;

    @ApiPropertyOptional({ description: 'Optional source identifier for the market data (exchange, aggregator, etc.)' })
    @IsOptional()
    @IsString()
    source?: string;
}
