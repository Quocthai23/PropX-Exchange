import { SupportTicketStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSupportDto {
  @ApiProperty({
    description: 'New status of the support ticket',
    enum: SupportTicketStatus,
    example: SupportTicketStatus.IN_PROGRESS,
  })
  @IsEnum(SupportTicketStatus)
  status: SupportTicketStatus;
}
