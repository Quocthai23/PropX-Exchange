import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class SubmitKycDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsDateString()
  dateOfBirth: string;

  @IsString()
  @IsNotEmpty()
  identityNumber: string;


  @IsString() frontImageUrl: string;
  @IsString() backImageUrl: string;
  @IsString() selfieImageUrl: string;
}
