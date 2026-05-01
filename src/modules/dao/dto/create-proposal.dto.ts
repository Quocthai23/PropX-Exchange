import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateProposalDto {
  @ApiProperty({ example: 'Should we sell the project outright for 3.5 billion?' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  title: string;

  @ApiProperty({ description: 'Proposal details' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  description: string;

  @ApiProperty({
    description: 'Snapshot time (ISO)',
    example: '2026-05-01T00:00:00.000Z',
  })
  @IsDateString()
  snapshotDate: string;

  @ApiProperty({
    description: 'Voting end time (ISO)',
    example: '2026-05-08T00:00:00.000Z',
  })
  @IsDateString()
  endDate: string;
}
