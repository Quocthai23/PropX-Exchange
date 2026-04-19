import { SupportTicketStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateSupportDto {
  @IsEnum(SupportTicketStatus)
  status: SupportTicketStatus;
}
