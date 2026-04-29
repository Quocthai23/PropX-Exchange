import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsEnum,
  MaxLength,
  MinLength,
} from 'class-validator';
import { $Enums } from '@prisma/client';

export class CreateSupportTicketDto {
  @ApiProperty({
    description: 'Ticket subject',
    enum: [
      'Account Issue',
      'Deposit',
      'Withdrawal',
      'Trading Issue',
      'Technical Issue',
      'Verification',
      'Billing',
      'Other',
    ],
  })
  @IsString()
  @IsEnum([
    'Account Issue',
    'Deposit',
    'Withdrawal',
    'Trading Issue',
    'Technical Issue',
    'Verification',
    'Billing',
    'Other',
  ])
  subject: string;

  @ApiProperty({
    description: 'Initial message content',
    minLength: 1,
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(5000)
  message: string;

  @ApiPropertyOptional({ description: 'Optional title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Optional category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Optional priority (free-form string)' })
  @IsOptional()
  @IsString()
  priority?: string;
}

export class UpdateSupportTicketDto {
  @ApiPropertyOptional({ description: 'Ticket subject' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Optional title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Optional category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Optional priority (free-form string)' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({
    description: 'Ticket status',
    enum: $Enums.SupportTicketStatus,
  })
  @IsOptional()
  @IsEnum($Enums.SupportTicketStatus)
  status?: $Enums.SupportTicketStatus;
}

export class SupportMessageDto {
  @ApiProperty({
    description: 'Message content',
    minLength: 1,
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({
    description: 'Message type. 0 = TEXT, 1 = IMAGE',
    enum: [0, 1],
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsEnum([0, 1])
  messageType?: number = 0;
}

export class GetSupportTicketsQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  take?: number = 20;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  skip?: number = 0;

  @ApiPropertyOptional({ enum: $Enums.SupportTicketStatus })
  @IsOptional()
  @IsEnum($Enums.SupportTicketStatus)
  status?: $Enums.SupportTicketStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ enum: ['createdAt'], default: 'createdAt' })
  @IsOptional()
  @IsEnum(['createdAt'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDir?: string = 'desc';
}

export class AdminGetSupportTicketsQueryDto extends GetSupportTicketsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() userId?: string;
}

export class GetMessagesQueryDto {
  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  take?: number = 50;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  skip?: number = 0;

  @ApiPropertyOptional({ description: 'Cursor for cursor-based pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;
}
