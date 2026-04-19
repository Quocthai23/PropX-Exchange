import {
  BadRequestException,
  Controller,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../users/dto/roles.decorator';
import { RolesGuard } from '../../users/dto/roles.guard';
import { CreateKycDto } from '../dto/create-kyc.dto';
import { RejectKycDto } from '../dto/reject-kyc.dto';
import { KycService } from '../services/kyc.service';

@Controller('kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  submit(
    @CurrentUser() user: JwtPayload | undefined,
    @Body() createKycDto: CreateKycDto,
  ) {
    if (!user?.sub) {
      throw new BadRequestException('Invalid authenticated user payload.');
    }
    return this.kycService.submitKyc(user.sub, createKycDto);
  }

  @Get('me')
  getMyKyc(@CurrentUser() user: JwtPayload | undefined) {
    if (!user?.sub) {
      throw new BadRequestException('Invalid authenticated user payload.');
    }
    return this.kycService.getMyKyc(user.sub);
  }

  @Get('admin/requests')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  listPending() {
    return this.kycService.listPendingRequests();
  }

  @Patch('admin/:userId/approve')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  approve(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    if (!user?.sub) {
      throw new BadRequestException('Invalid authenticated user payload.');
    }
    return this.kycService.approveKyc(userId, user.sub);
  }

  @Patch('admin/:userId/reject')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  reject(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: RejectKycDto,
  ) {
    if (!user?.sub) {
      throw new BadRequestException('Invalid authenticated user payload.');
    }
    return this.kycService.rejectKyc(userId, dto.reason, user.sub);
  }
}

