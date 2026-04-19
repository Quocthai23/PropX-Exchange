import {
  BadRequestException,
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { UsersService } from '../services/users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('health')
  healthCheck() {
    return this.usersService.healthCheck();
  }

  @Get('portfolio/overview')
  @UseGuards(JwtAuthGuard)
  async getPortfolioOverview(@CurrentUser() user: JwtPayload | undefined) {
    if (!user?.sub) {
      throw new BadRequestException('Invalid authenticated user payload.');
    }

    return this.usersService.getPortfolioOverview(user.sub);
  }
}
