import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateKycDto {
  @ApiProperty({ description: 'Full legal name', example: 'Nguyen Van A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName: string;

  @ApiProperty({
    description: 'Date of birth in ISO format',
    example: '1995-08-15',
  })
  @IsDateString()
  dob: string;

  @ApiProperty({
    description: 'Government-issued ID number',
    example: '012345678901',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  idNumber: string;

  @ApiProperty({ description: 'Front-side image URL of identity document' })
  @IsString()
  @IsNotEmpty()
  idFrontImg: string;

  @ApiProperty({ description: 'Back-side image URL of identity document' })
  @IsString()
  @IsNotEmpty()
  idBackImg: string;

  @ApiProperty({ description: 'Selfie image URL for identity verification' })
  @IsString()
  @IsNotEmpty()
  selfieImg: string;
}
