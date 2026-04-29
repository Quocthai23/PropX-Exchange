import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class VoteProposalDto {
  @ApiProperty({ description: 'True: For, False: Against' })
  @IsBoolean()
  isFor: boolean;
}

