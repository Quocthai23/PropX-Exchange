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
  IsEmail,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

const ACCOUNT_ID_REGEX = /^(real|demo)_[0-9]{8}$/;
const EMAIL_REGEX =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;
const AMOUNT_REGEX = /^-?\d+(\.\d+)?$/;

export class DepositDemoDto {
  @ApiProperty({ description: 'Account ID', pattern: ACCOUNT_ID_REGEX.source })
  @IsString()
  @Matches(ACCOUNT_ID_REGEX)
  accountId: string;
}

export class CreateWalletDto {
  @ApiProperty({ description: 'Account ID', pattern: ACCOUNT_ID_REGEX.source })
  @IsString()
  @Matches(ACCOUNT_ID_REGEX)
  accountId: string;

  @ApiProperty({ enum: ['EVM', 'SOL'], description: 'Wallet type' })
  @IsEnum(['EVM', 'SOL'])
  type: string;

  @ApiProperty({ enum: ['1', '56', '97', '11155111'], description: 'Chain ID' })
  @IsEnum(['1', '56', '97', '11155111'])
  chainId: string;
}

export class WithdrawV2Dto {
  @ApiProperty({ description: 'Account ID', pattern: ACCOUNT_ID_REGEX.source })
  @IsString()
  @Matches(ACCOUNT_ID_REGEX)
  accountId: string;

  @ApiProperty({ description: 'Withdrawal amount' })
  @IsString()
  @Matches(AMOUNT_REGEX)
  amount: string;

  @ApiProperty({ description: 'Blockchain wallet address' })
  @IsString()
  @IsNotEmpty()
  address: string;

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
  @ApiProperty({
    description: 'Sender Account ID',
    pattern: ACCOUNT_ID_REGEX.source,
  })
  @IsString()
  @Matches(ACCOUNT_ID_REGEX)
  fromAccountId: string;

  @ApiProperty({ description: 'Amount to transfer as a string' })
  @IsString()
  @Matches(AMOUNT_REGEX)
  amount: string;

  @ApiProperty({
    description: 'Recipient user email, used for validation only',
    pattern: EMAIL_REGEX.source,
  })
  @IsEmail()
  @Matches(EMAIL_REGEX)
  toUserEmail: string;

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

  @ApiPropertyOptional({ pattern: ACCOUNT_ID_REGEX.source })
  @IsOptional()
  @IsString()
  @Matches(ACCOUNT_ID_REGEX)
  accountId?: string;

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
    description: 'New status (3 = COMPLETED, 5 = REJECTED)',
    enum: [3, 5],
  })
  @IsInt()
  @IsEnum([3, 5])
  status: number;

  @ApiPropertyOptional({ description: 'Required if status is 3 (COMPLETED)' })
  @ValidateIf((o: AdminUpdateWithdrawStatusDto) => o.status === 3)
  @IsString()
  @IsNotEmpty()
  transactionHash?: string;

  @ApiPropertyOptional({ description: 'Required if status is 5 (REJECTED)' })
  @ValidateIf((o: AdminUpdateWithdrawStatusDto) => o.status === 5)
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
