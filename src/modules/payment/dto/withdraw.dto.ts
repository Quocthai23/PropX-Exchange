import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WithdrawDto {
  @ApiProperty({ description: 'Withdrawal amount in USDT', example: 150.5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;
}
