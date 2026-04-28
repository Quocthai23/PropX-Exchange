import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
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

export class UpdateSupportTicketDto {
  @ApiPropertyOptional({
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
  @IsOptional()
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
  subject?: string;

  @ApiPropertyOptional({
    description:
      'Ticket status. 0 = OPEN, 1 = IN_PROGRESS, 2 = RESOLVED, 3 = CLOSED',
    enum: [0, 1, 2, 3],
  })
  @IsOptional()
  @Type(() => Number)
  @IsEnum([0, 1, 2, 3])
  status?: number;

  @ApiPropertyOptional({
    description: 'Ticket priority. 0 = LOW, 1 = MEDIUM, 2 = HIGH, 3 = URGENT',
    enum: [0, 1, 2, 3],
  })
  @IsOptional()
  @Type(() => Number)
  @IsEnum([0, 1, 2, 3])
  priority?: number;
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

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map(Number) : [Number(value)],
  )
  status?: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map(Number) : [Number(value)],
  )
  priority?: number[];

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

  @ApiPropertyOptional({ description: 'Cursor for cursor-based pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;
}
