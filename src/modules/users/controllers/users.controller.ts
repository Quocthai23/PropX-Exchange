import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { UsersService } from '../services/users.service';
import { UpdateProfileDto, UpdateReferralDto } from '../dto/update-user.dto';
import {
  GetRelationsDto,
  SuggestUsersDto,
  ToggleFavoriteAssetDto,
  UpsertRelationDto,
} from '../dto/create-user.dto';

@ApiTags('Users')
@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check for Users module' })
  healthCheck() {
    return this.usersService.healthCheck();
  }

  @Get('profile/:id')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get public user profile' })
  @ApiResponse({ status: 200, description: 'Response for status 200' })
  async getProfileById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload | undefined,
  ) {
    return await this.usersService.getPublicProfile(id, user?.sub);
  }

  @Post()
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update profile' })
  @ApiResponse({ status: 200, description: 'Response for status 200' })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return await this.usersService.updateProfile(user.sub, dto);
  }

  @Get('me')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get profile' })
  @ApiResponse({ status: 200, description: 'Response for status 200' })
  async getMe(@CurrentUser() user: JwtPayload) {
    return await this.usersService.getMyProfile(user.sub);
  }

  @Delete('me')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete account' })
  @ApiResponse({ status: 200, description: 'Response for status 200' })
  async deleteMe(@CurrentUser() user: JwtPayload) {
    return await this.usersService.softDeleteAccount(user.sub);
  }

  @Get('suggestions')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Suggest users' })
  @ApiResponse({ status: 200, description: 'Response for status 200' })
  async getSuggestions(
    @CurrentUser() user: JwtPayload,
    @Query() query: SuggestUsersDto,
  ) {
    return await this.usersService.getSuggestions(user.sub, query.take || 5);
  }

  @Get(':userId/relations')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user relation list' })
  @ApiResponse({ status: 200, description: 'Response for status 200' })
  async getRelations(
    @Param('userId') userId: string,
    @Query() query: GetRelationsDto,
  ) {
    return await this.usersService.getRelations(
      userId,
      query.relation,
      query.skip || 0,
      query.take || 20,
    );
  }

  @Post('favorites/assets')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle favorite asset' })
  @ApiResponse({ status: 200, description: 'Response for status 200' })
  async toggleFavoriteAsset(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ToggleFavoriteAssetDto,
  ) {
    return await this.usersService.toggleFavoriteAsset(user.sub, dto);
  }

  @Put(':id/relation')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Upsert user relation' })
  @ApiResponse({ status: 200, description: 'Response for status 200' })
  async upsertRelation(
    @CurrentUser() user: JwtPayload,
    @Param('id') targetUserId: string,
    @Body() dto: UpsertRelationDto,
  ) {
    return await this.usersService.upsertRelation(user.sub, targetUserId, dto);
  }

  @Patch('referral')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update referral reference code' })
  @ApiResponse({ status: 200, description: 'Response for status 200' })
  async updateReferral(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateReferralDto,
  ) {
    return await this.usersService.updateReferral(user.sub, dto);
  }

  @Get('portfolio/overview')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Get portfolio overview' })
  async getPortfolioOverview(@CurrentUser() user: JwtPayload | undefined) {
    if (!user?.sub) {
      throw new BadRequestException('Invalid authenticated user payload.');
    }

    return this.usersService.getPortfolioOverview(user.sub);
  }
}
