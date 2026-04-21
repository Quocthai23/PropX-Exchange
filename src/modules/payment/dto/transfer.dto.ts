import { Type } from 'class-transformer';
import { IsEmail, IsNumber, Min } from 'class-validator';

export class TransferDto {
  @IsEmail()
  recipientEmail: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;
}
