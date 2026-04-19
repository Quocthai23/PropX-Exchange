import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';

import { RequestOtpDto, VerifyOtpDto } from './dto/auth.dto'; 
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { JwtPayload } from './types/jwt-payload.type';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import type { Response, Request } from 'express';

@ApiTags('1. Auth - Email & Wallet Generation')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private getRefreshCookieConfig() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
  }

  @Post('request-otp')
  @Throttle({ short: { limit: 3, ttl: 300000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request OTP for login/register via Email' })
  @ApiResponse({
    status: 200,
    description: 'OTP sent to email',
  })
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.email);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and get JWT Token (Auto-generates wallet for new users)' })
  @ApiResponse({
    status: 200,
    description: 'Login successful, return JWT Token',
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.verifyOtp(dto.email, dto.otpCode);
    

    res.cookie('refresh_token', result.refreshToken, this.getRefreshCookieConfig());

    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a new access token from the refresh token in cookie' })
  async refreshTokens(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token found');
    }

    try {
      const tokens = await this.authService.refreshAccessToken(refreshToken);
      res.cookie('refresh_token', tokens.refreshToken, this.getRefreshCookieConfig());
      return { accessToken: tokens.accessToken };
    } catch {
      res.clearCookie('refresh_token');
      throw new UnauthorizedException('Refresh token expired or invalid');
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.['refresh_token'];

    if (refreshToken) {
      await this.authService.revokeRefreshTokenByToken(refreshToken);
    }

    res.clearCookie('refresh_token');
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile (Requires JWT Token)' })
  @ApiResponse({
    status: 200,
    description: 'Return user info from token payload',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  getProfile(@CurrentUser() user: JwtPayload) {
    return { message: 'Authentication successful!', user };
  }
}
