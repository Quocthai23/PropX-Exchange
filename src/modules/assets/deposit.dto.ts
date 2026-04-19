import { Type } from 'class-transformer';
import {
  IsEthereumAddress,
  IsNotEmpty,
  IsNumber,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class DepositDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^0x([A-Fa-f0-9]{64})$/)
  txHash: string;

  @IsEthereumAddress()
  walletAddress: string;
}
