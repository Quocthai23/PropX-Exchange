import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSupportDto {
  @ApiProperty({
    description: 'Support ticket subject',
    example: 'Unable to complete withdrawal',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(191)
  subject: string;

  @ApiProperty({
    description: 'Detailed support request content',
    example: 'Withdrawal request is still pending after 2 hours.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  content: string;
}
