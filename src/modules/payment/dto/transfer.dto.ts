import { Type } from 'class-transformer';
import { IsEmail, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransferDto {
  @ApiProperty({
    description: 'Recipient email address',
    example: 'investor@example.com',
  })
  @IsEmail()
  recipientEmail: string;

  @ApiProperty({ description: 'Transfer amount in USDT', example: 250 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;
}
