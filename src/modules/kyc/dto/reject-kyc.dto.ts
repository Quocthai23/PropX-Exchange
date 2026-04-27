import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectKycDto {
  @ApiProperty({
    description: 'Reason for rejecting a KYC submission',
    example: 'Uploaded documents are blurry and unreadable',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason: string;
}
