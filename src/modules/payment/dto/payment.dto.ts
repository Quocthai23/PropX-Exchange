import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  Matches,
  IsEnum,
  IsUUID,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { $Enums } from '@prisma/client';

const AMOUNT_REGEX = /^-?\d+(\.\d+)?$/;

export class DepositDemoDto {
  @ApiProperty({ description: 'Deposit amount' })
  @IsString()
  @Matches(AMOUNT_REGEX)
  amount: string;

  @ApiPropertyOptional({
    description: 'Client-generated UUID to prevent duplicate submissions',
  })
  @IsOptional()
  @IsUUID('4')
  idempotencyKey?: string;
}

export class CreateWalletDto {
  @ApiPropertyOptional({ enum: ['EVM', 'SOL'], description: 'Wallet type' })
  @IsOptional()
  @IsEnum(['EVM', 'SOL'])
  type?: string;

  @ApiPropertyOptional({
    enum: ['1', '56', '97', '11155111'],
    description: 'Chain ID',
  })
  @IsOptional()
  @IsEnum(['1', '56', '97', '11155111'])
  chainId?: string;
}

export class WithdrawV2Dto {
  @ApiProperty({ description: 'Withdrawal amount' })
  @IsString()
  @Matches(AMOUNT_REGEX)
  amount: string;

  @ApiProperty({ description: 'Blockchain wallet address' })
  @IsString()
  @IsNotEmpty()
  destinationAddress: string;

  @ApiProperty({ enum: ['1', '56', '97', '11155111'], description: 'Chain ID' })
  @IsEnum(['1', '56', '97', '11155111'])
  chainId: string;

  @ApiProperty({
    description: 'Client-generated UUID to prevent duplicate submissions',
  })
  @IsUUID('4')
  idempotencyKey: string;

  @ApiProperty({
    description: 'Verified challengeId from /auth/challenge/verify',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  challengeId: string;
}

export class TransferV2Dto {
  @ApiProperty({ description: 'Amount to transfer as a string' })
  @IsString()
  @Matches(AMOUNT_REGEX)
  amount: string;

  @ApiPropertyOptional({ description: 'Asset ID' })
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiProperty({
    description: 'Client-generated UUID to prevent duplicate submissions',
  })
  @IsUUID('4')
  idempotencyKey: string;

  @ApiProperty({
    description: 'Verified challengeId from /auth/challenge/verify',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  challengeId: string;
}

export class GetTransactionHistoryDto {
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({
    description: 'Transaction type',
    enum: $Enums.TransactionType,
  })
  @IsOptional()
  @IsEnum($Enums.TransactionType)
  type?: $Enums.TransactionType;

  @ApiPropertyOptional({
    description: 'Transaction status',
    enum: $Enums.TransactionStatus,
  })
  @IsOptional()
  @IsEnum($Enums.TransactionStatus)
  status?: $Enums.TransactionStatus;

  @ApiPropertyOptional({ description: 'Start date (ISO format)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO format)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class AdminUpdateWithdrawStatusDto {
  @ApiProperty({
    description: 'New status',
    enum: ['COMPLETED', 'FAILED', 'CANCELLED'],
  })
  @IsEnum($Enums.TransactionStatus)
  status: $Enums.TransactionStatus;

  @ApiPropertyOptional({ description: 'Required if status is COMPLETED' })
  @ValidateIf((o: AdminUpdateWithdrawStatusDto) => o.status === 'COMPLETED')
  @IsString()
  @IsNotEmpty()
  transactionHash?: string;

  @ApiPropertyOptional({
    description: 'Required if status is FAILED or CANCELLED',
  })
  @ValidateIf(
    (o: AdminUpdateWithdrawStatusDto) =>
      o.status === 'FAILED' || o.status === 'CANCELLED',
  )
  @IsString()
  @IsNotEmpty()
  rejectedReason?: string;

  @ApiProperty({ description: 'Idempotency key to prevent double execution' })
  @IsUUID('4')
  idempotencyKey: string;
}

export class AdminSweepFundsDto {
  @ApiProperty({ enum: ['1', '56', '97', '11155111'], description: 'Chain ID' })
  @IsEnum(['1', '56', '97', '11155111'])
  chainId: string;

  @ApiProperty({ description: 'Destination wallet address to sweep funds to' })
  @IsString()
  @IsNotEmpty()
  destinationWallet: string;

  @ApiProperty({
    description: 'Private key of the admin wallet used for sweeping',
  })
  @IsString()
  @IsNotEmpty()
  privateKey: string;
}
