import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectKycDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason: string;
}
