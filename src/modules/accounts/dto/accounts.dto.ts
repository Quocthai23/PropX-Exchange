import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({ description: 'Account type ID' })
  @IsUUID()
  @IsNotEmpty()
  accountTypeId: string;

  @ApiProperty({ description: 'Account name' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateAccountDto {
  @ApiPropertyOptional({ description: 'Account name' })
  @IsOptional()
  @IsString()
  name?: string;
}
