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

  // Giả sử client đã upload file qua 1 API khác (như AWS S3) và trả về URL
  @IsString() frontImageUrl: string;
  @IsString() backImageUrl: string;
  @IsString() selfieImageUrl: string;
}
