import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { SupportService } from '../services/support.service';
import { CreateSupportDto } from '../dto/create-support.dto';
import { UpdateSupportDto } from '../dto/update-support.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { Roles } from '../../users/dto/roles.decorator';
import { RolesGuard } from '../../users/dto/roles.guard';

@Controller('support')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  @Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } })
  create(
    @CurrentUser() user: JwtPayload | undefined,
    @Body() createSupportDto: CreateSupportDto,
  ) {
    if (!user?.sub) {
      throw new BadRequestException('Invalid authenticated user payload.');
    }

    return this.supportService.create(user.sub, createSupportDto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload | undefined) {
    if (!user?.sub) {
      throw new BadRequestException('Invalid authenticated user payload.');
    }

    return this.supportService.findAll(user);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!user?.sub) {
      throw new BadRequestException('Invalid authenticated user payload.');
    }

    return this.supportService.findOne(id, user);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPPORT_STAFF')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSupportDto: UpdateSupportDto,
  ) {
    return this.supportService.update(id, updateSupportDto);
  }
}
