import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class TokenizeOnboardingDto {
  @ApiProperty({ description: 'On-chain token symbol', example: 'RWA-VINH-01' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  symbol: string;

  @ApiProperty({ description: 'Asset category ID' })
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({ description: 'Total supply to mint', example: '1000000' })
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'totalSupply must be a decimal string' })
  totalSupply: string;

  @ApiProperty({ description: 'Initial token price (USDT)', example: '1' })
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'tokenPrice must be a decimal string' })
  tokenPrice: string;

  @ApiPropertyOptional({ description: 'ERC20 / ERC3643 ...', example: 'ERC20' })
  @IsOptional()
  @IsString()
  tokenStandard?: string;

  @ApiPropertyOptional({
    description: 'SPV legal entity that holds the underlying asset',
    example: 'RWA SPV JSC',
  })
  @IsOptional()
  @IsString()
  spvName?: string;

  @ApiPropertyOptional({
    description: 'Periodic audit report link',
    example: 'https://example.com/audit/report.pdf',
  })
  @IsOptional()
  @IsString()
  auditReportUrl?: string;
}

