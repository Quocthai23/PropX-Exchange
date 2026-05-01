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
    description: 'Subject category of the support ticket.',
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
    example: 'Withdrawal',
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
    description: 'Initial message content describing the issue. Between 1 and 5000 characters.',
    minLength: 1,
    maxLength: 5000,
    example: 'My withdrawal of 100 USDT submitted 2 days ago is still pending. Transaction ID: TXN_123.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(5000)
  message: string;

  @ApiPropertyOptional({
    description: 'Optional human-readable title for the ticket.',
    example: 'Withdrawal stuck for 48 hours',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Optional category tag to route the ticket to the correct team.',
    example: 'Finance',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Optional priority label (free-form string). Examples: low, medium, high, urgent.',
    example: 'high',
  })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({
    description: 'Array of attachment URLs (e.g. screenshots, transaction receipts).',
    example: ['https://cdn.example.com/screenshots/txn_error.png'],
    type: [String],
  })
  @IsOptional()
  attachments?: any;
}

export class UpdateSupportTicketDto {
  @ApiPropertyOptional({
    description: 'Updated subject category of the ticket.',
    example: 'Billing',
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({
    description: 'Updated ticket title.',
    example: 'Resolved: Withdrawal issue',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated routing category.',
    example: 'Finance',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Updated priority label.',
    example: 'low',
  })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({
    description: 'Updated ticket status (managed by support agents).',
    enum: $Enums.SupportTicketStatus,
    example: 'RESOLVED',
  })
  @IsOptional()
  @IsEnum($Enums.SupportTicketStatus)
  status?: $Enums.SupportTicketStatus;
}

export class SupportMessageDto {
  @ApiProperty({
    description: 'Message content to send in the support thread. Between 1 and 5000 characters.',
    minLength: 1,
    maxLength: 5000,
    example: 'Thank you for the update! I can confirm the withdrawal was received.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({
    description: 'Message type. 0 = plain TEXT message, 1 = IMAGE message.',
    enum: [0, 1],
    default: 0,
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsEnum([0, 1])
  messageType?: number = 0;

  @ApiPropertyOptional({
    description: 'Array of attachment URLs for this message.',
    example: ['https://cdn.example.com/screenshots/receipt.png'],
    type: [String],
  })
  @IsOptional()
  attachments?: any;
}

export class GetSupportTicketsQueryDto {
  @ApiPropertyOptional({
    default: 20,
    minimum: 1,
    maximum: 100,
    description: 'Number of tickets to return.',
    example: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  take?: number = 20;

  @ApiPropertyOptional({
    description: 'Cursor string for cursor-based pagination. Omit for the first page.',
    example: 'ticket_01J2XABCDEF',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Filter tickets by status.',
    enum: $Enums.SupportTicketStatus,
    example: 'OPEN',
  })
  @IsOptional()
  @IsEnum($Enums.SupportTicketStatus)
  status?: $Enums.SupportTicketStatus;

  @ApiPropertyOptional({
    description: 'Filter tickets by category tag.',
    example: 'Finance',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Filter tickets by priority label.',
    example: 'high',
  })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({
    enum: ['createdAt'],
    default: 'createdAt',
    description: 'Field to sort results by.',
    example: 'createdAt',
  })
  @IsOptional()
  @IsEnum(['createdAt'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    default: 'desc',
    description: 'Sort direction.',
    example: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDir?: string = 'desc';
}

export class AdminGetSupportTicketsQueryDto extends GetSupportTicketsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter tickets by a specific user ID (admin use only).',
    example: 'usr_01J2XABCDEF',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}

export class GetMessagesQueryDto {
  @ApiPropertyOptional({
    default: 50,
    minimum: 1,
    maximum: 100,
    description: 'Number of messages to return.',
    example: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  take?: number = 50;

  @ApiPropertyOptional({
    default: 0,
    minimum: 0,
    description: 'Number of messages to skip (offset pagination).',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  skip?: number = 0;

  @ApiPropertyOptional({
    description: 'Cursor string for cursor-based pagination.',
    example: 'msg_01J2XABCDEF',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
