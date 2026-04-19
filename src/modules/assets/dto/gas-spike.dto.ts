export class GasSpeedUpDto {
  transactionId: string;
  multiplier: number; // Gas price multiplier (e.g., 1.5 for 50% increase)
}

export class GasRefundDto {
  transactionId: string;
  reason?: string; // Optional reason for refund request
}

export class GasStatusDto {
  transactionId: string;
}
