import { Body, Controller, Param, Post, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import type { JwtPayload } from '@/modules/auth/types/jwt-payload.type';
import { CreateProposalDto } from '../dto/create-proposal.dto';
import { DaoService } from '../services/dao.service';
import { VoteProposalDto } from '../dto/vote-proposal.dto';
import { RolesGuard } from '@/modules/users/dto/roles.guard';
import { Roles } from '@/modules/users/dto/roles.decorator';

@Controller()
export class DaoController {
  constructor(private readonly daoService: DaoService) {}

  @ApiTags('DAO Governance')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('assets/:id/proposals')
  @ApiOperation({ summary: 'Create DAO proposal for an asset' })
  async createProposal(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('id') assetId: string,
    @Body() dto: CreateProposalDto,
  ) {
    return this.daoService.createProposal(user?.sub ?? 'SYSTEM', assetId, dto);
  }

  @ApiTags('DAO Governance')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('proposals/:id/vote')
  @ApiOperation({ summary: 'Vote on a proposal' })
  async vote(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('id') proposalId: string,
    @Body() dto: VoteProposalDto,
  ) {
    return this.daoService.vote(user?.sub ?? 'SYSTEM', proposalId, dto);
  }

  @ApiTags('Admin - DAO Governance')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/proposals/:id/execute')
  @ApiOperation({ summary: 'Mark a passed proposal as executed (admin)' })
  async execute(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('id') proposalId: string,
  ) {
    return this.daoService.executeProposal(proposalId, user?.sub ?? 'SYSTEM');
  }
}

