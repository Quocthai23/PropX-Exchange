import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateKycDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName: string;

  @IsDateString()
  dob: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  idNumber: string;

  @IsString()
  @IsNotEmpty()
  idFrontImg: string;

  @IsString()
  @IsNotEmpty()
  idBackImg: string;

  @IsString()
  @IsNotEmpty()
  selfieImg: string;
}
