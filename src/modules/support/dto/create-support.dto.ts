import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSupportDto {
  @IsString()
  @MinLength(3)
  @MaxLength(191)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  content: string;
}
