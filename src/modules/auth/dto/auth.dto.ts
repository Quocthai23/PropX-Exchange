import { ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress, IsNotEmpty, IsString } from 'class-validator';

export class GenerateNonceDto {
  @ApiProperty({ description: 'User MetaMask wallet address' })
  @IsEthereumAddress()
  @IsNotEmpty()
  walletAddress: string;
}

export class VerifySignatureDto {
  @ApiProperty({ description: 'User MetaMask wallet address' })
  @IsEthereumAddress()
  @IsNotEmpty()
  walletAddress: string;

  @ApiProperty({ description: 'Signature generated from MetaMask wallet' })
  @IsString()
  @IsNotEmpty()
  signature: string;
}
