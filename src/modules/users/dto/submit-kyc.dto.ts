import { IsString, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitKycDto {
  @ApiProperty({ description: 'Full legal name', example: 'Tran Thi B' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    description: 'Date of birth in ISO format',
    example: '1998-01-20',
  })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({
    description: 'Government-issued identity number',
    example: '079123456789',
  })
  @IsString()
  @IsNotEmpty()
  identityNumber: string;

  @ApiProperty({ description: 'Front-side image URL of identity document' })
  @IsString()
  frontImageUrl: string;

  @ApiProperty({ description: 'Back-side image URL of identity document' })
  @IsString()
  backImageUrl: string;

  @ApiProperty({ description: 'Selfie image URL for liveness verification' })
  @IsString()
  selfieImageUrl: string;
}
