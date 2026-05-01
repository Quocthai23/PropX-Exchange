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
  @ApiProperty({
    description: 'Deposit amount as a decimal string. Must be a valid positive number.',
    example: '500.00',
    pattern: '^-?\\d+(\\.\\d+)?$',
  })
  @IsString()
  @Matches(AMOUNT_REGEX)
  amount: string;

  @ApiPropertyOptional({
    description: 'Client-generated UUID v4 to prevent duplicate deposit submissions (idempotency).',
    example: '550e8400-e29b-41d4-a716-446655440000',
    pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  })
  @IsOptional()
  @IsUUID('4')
  idempotencyKey?: string;
}

export class CreateWalletDto {
  @ApiProperty({
    description:
      'User wallet address (non-custodial). The backend does not store private keys. Must be a valid blockchain address.',
    example: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    pattern: '^0x[a-fA-F0-9]{40}$',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiPropertyOptional({
    enum: ['EVM', 'SOL'],
    description: 'Wallet chain type. EVM for Ethereum-compatible chains, SOL for Solana.',
    example: 'EVM',
  })
  @IsOptional()
  @IsEnum(['EVM', 'SOL'])
  type?: string;

  @ApiPropertyOptional({
    enum: ['1', '56', '97', '11155111'],
    description:
      'EVM chain ID. 1 = Ethereum Mainnet, 56 = BSC Mainnet, 97 = BSC Testnet, 11155111 = Sepolia.',
    example: '56',
  })
  @IsOptional()
  @IsEnum(['1', '56', '97', '11155111'])
  chainId?: string;
}

export class WithdrawV2Dto {
  @ApiProperty({
    description: 'Withdrawal amount as a decimal string.',
    example: '100.50',
    pattern: '^-?\\d+(\\.\\d+)?$',
  })
  @IsString()
  @Matches(AMOUNT_REGEX)
  amount: string;

  @ApiProperty({
    description: 'Destination blockchain wallet address to send funds to.',
    example: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    pattern: '^0x[a-fA-F0-9]{40}$',
  })
  @IsString()
  @IsNotEmpty()
  destinationAddress: string;

  @ApiProperty({
    enum: ['1', '56', '97', '11155111'],
    description:
      'Target EVM chain ID for the withdrawal. 1 = Mainnet, 56 = BSC, 97 = BSC Testnet, 11155111 = Sepolia.',
    example: '56',
  })
  @IsEnum(['1', '56', '97', '11155111'])
  chainId: string;

  @ApiProperty({
    description: 'Client-generated UUID v4 to prevent duplicate withdrawal submissions.',
    example: '550e8400-e29b-41d4-a716-446655440000',
    pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  })
  @IsUUID('4')
  idempotencyKey: string;

  @ApiProperty({
    description: 'Verified challengeId from POST /auth/challenge/verify — proves MFA was completed.',
    example: 'chal_01J2XABCDEF123',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  challengeId: string;
}

export class TransferV2Dto {
  @ApiProperty({
    description: 'Amount to transfer as a decimal string.',
    example: '50.00',
    pattern: '^-?\\d+(\\.\\d+)?$',
  })
  @IsString()
  @Matches(AMOUNT_REGEX)
  amount: string;

  @ApiPropertyOptional({
    description: 'Asset ID to transfer. If omitted, transfers the default balance currency (USDT).',
    example: 'asset_01J2XAAPL',
  })
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiPropertyOptional({
    description: 'Recipient user ID. Either toUserId or toEmail must be provided.',
    example: 'usr_01J2XABCDEF',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  toUserId?: string;

  @ApiPropertyOptional({
    description: 'Recipient email address. Either toUserId or toEmail must be provided.',
    example: 'recipient@example.com',
    format: 'email',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  toEmail?: string;

  @ApiProperty({
    description: 'Client-generated UUID v4 to prevent duplicate transfer submissions.',
    example: '550e8400-e29b-41d4-a716-446655440000',
    pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  })
  @IsUUID('4')
  idempotencyKey: string;

  @ApiProperty({
    description: 'Verified challengeId from POST /auth/challenge/verify — proves MFA was completed.',
    example: 'chal_01J2XABCDEF123',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  challengeId: string;
}

export class GetTransactionHistoryDto {
  @ApiPropertyOptional({
    default: 20,
    minimum: 1,
    maximum: 100,
    description: 'Number of transaction records to return.',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;

  @ApiPropertyOptional({
    default: 0,
    minimum: 0,
    description: 'Number of records to skip (offset pagination).',
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({
    description: 'Filter by transaction type (e.g. DEPOSIT, WITHDRAW, TRANSFER).',
    enum: $Enums.TransactionType,
    example: 'DEPOSIT',
  })
  @IsOptional()
  @IsEnum($Enums.TransactionType)
  type?: $Enums.TransactionType;

  @ApiPropertyOptional({
    description: 'Filter by transaction status (e.g. PENDING, COMPLETED, FAILED).',
    enum: $Enums.TransactionStatus,
    example: 'COMPLETED',
  })
  @IsOptional()
  @IsEnum($Enums.TransactionStatus)
  status?: $Enums.TransactionStatus;

  @ApiPropertyOptional({
    description: 'Start date filter (ISO 8601 format). Returns transactions created on or after this date.',
    example: '2026-01-01T00:00:00.000Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date filter (ISO 8601 format). Returns transactions created on or before this date.',
    example: '2026-12-31T23:59:59.999Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class AdminUpdateWithdrawStatusDto {
  @ApiProperty({
    description: 'New transaction status to apply. Use COMPLETED when the on-chain transaction is confirmed.',
    enum: ['COMPLETED', 'FAILED', 'CANCELLED'],
    example: 'COMPLETED',
  })
  @IsEnum($Enums.TransactionStatus)
  status: $Enums.TransactionStatus;

  @ApiPropertyOptional({
    description: 'On-chain transaction hash. Required when status is COMPLETED.',
    example: '0xabc123def456...',
    pattern: '^0x[a-fA-F0-9]{64}$',
  })
  @ValidateIf((o: AdminUpdateWithdrawStatusDto) => o.status === 'COMPLETED')
  @IsString()
  @IsNotEmpty()
  transactionHash?: string;

  @ApiPropertyOptional({
    description: 'Reason for rejection or cancellation. Required when status is FAILED or CANCELLED.',
    example: 'Insufficient gas on destination chain.',
  })
  @ValidateIf(
    (o: AdminUpdateWithdrawStatusDto) =>
      o.status === 'FAILED' || o.status === 'CANCELLED',
  )
  @IsString()
  @IsNotEmpty()
  rejectedReason?: string;

  @ApiProperty({
    description: 'UUID v4 to prevent double-execution of the same status update.',
    example: '550e8400-e29b-41d4-a716-446655440000',
    pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  })
  @IsUUID('4')
  idempotencyKey: string;
}

export class AdminSweepFundsDto {
  @ApiProperty({
    enum: ['1', '56', '97', '11155111'],
    description:
      'EVM chain ID of the network to sweep funds from. 1 = Mainnet, 56 = BSC, 97 = BSC Testnet, 11155111 = Sepolia.',
    example: '56',
  })
  @IsEnum(['1', '56', '97', '11155111'])
  chainId: string;

  @ApiProperty({
    description: 'Destination wallet address to aggregate all swept funds into.',
    example: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    pattern: '^0x[a-fA-F0-9]{40}$',
  })
  @IsString()
  @IsNotEmpty()
  destinationWallet: string;

  @ApiProperty({
    description: 'Private key of the admin wallet used to sign sweep transactions. Handle with extreme care.',
    example: '0xprivate_key_hex...',
  })
  @IsString()
  @IsNotEmpty()
  privateKey: string;
}
