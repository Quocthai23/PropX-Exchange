import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GasSpeedUpDto {
  @ApiProperty({
    description: 'Transaction ID that needs gas speed-up',
    example: 'txn_01J2X7P6TQ8Y3M9ABCD1234',
  })
  transactionId: string;

  @ApiProperty({
    description: 'Gas price multiplier (e.g., 1.5 means 50% increase)',
    example: 1.5,
  })
  multiplier: number; // Gas price multiplier (e.g., 1.5 for 50% increase)
}

export class GasRefundDto {
  @ApiProperty({
    description: 'Transaction ID for gas refund request',
    example: 'txn_01J2X7P6TQ8Y3M9ABCD1234',
  })
  transactionId: string;

  @ApiPropertyOptional({
    description: 'Optional reason for refund request',
    example: 'Gas fee exceeded configured threshold',
  })
  reason?: string; // Optional reason for refund request
}

export class GasStatusDto {
  @ApiProperty({
    description: 'Transaction ID to check gas handling status',
    example: 'txn_01J2X7P6TQ8Y3M9ABCD1234',
  })
  transactionId: string;
}
