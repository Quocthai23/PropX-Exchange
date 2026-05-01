import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateKycDto {
  @ApiProperty({
    description: 'Full legal name as it appears on the official identity document.',
    example: 'Nguyen Van An',
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName: string;

  @ApiProperty({
    description: 'Date of birth in ISO 8601 format (YYYY-MM-DD).',
    example: '1995-08-15',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
    format: 'date',
  })
  @IsDateString()
  dob: string;

  @ApiProperty({
    description: 'Government-issued national ID, passport, or driver\'s license number.',
    example: '012345678901',
    maxLength: 40,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  idNumber: string;

  @ApiProperty({
    description: 'Publicly accessible URL of the front-side image of the identity document.',
    example: 'https://cdn.example.com/kyc/id_front_user123.jpg',
    format: 'uri',
  })
  @IsString()
  @IsNotEmpty()
  idFrontImg: string;

  @ApiProperty({
    description: 'Publicly accessible URL of the back-side image of the identity document.',
    example: 'https://cdn.example.com/kyc/id_back_user123.jpg',
    format: 'uri',
  })
  @IsString()
  @IsNotEmpty()
  idBackImg: string;

  @ApiProperty({
    description: 'Publicly accessible URL of the selfie image for liveness/identity verification.',
    example: 'https://cdn.example.com/kyc/selfie_user123.jpg',
    format: 'uri',
  })
  @IsString()
  @IsNotEmpty()
  selfieImg: string;
}
