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
import { AuthService } from '../services/auth.service';
import {
  SendOtpDto,
  VerifyOtpDto,
  RegisterDto,
  LoginDto,
  AuthChallengeDto,
  LoginWithSocialDto,
  ResetPasswordDto,
  CheckEmailDto,
  CheckReferenceCodeDto,
  VerifyChallengeDto,
  ChangePasswordDto,
} from '../dto/auth.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { JwtPayload } from '../types/jwt-payload.type';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import type { Response, Request } from 'express';

@ApiTags('Auth')
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

  @Post('send-otp')
  @ApiBearerAuth()
  @Throttle({ short: { limit: 3, ttl: 300000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP' })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully.',
  })
  async sendOtp(
    @Body() dto: SendOtpDto,
    @CurrentUser() user?: JwtPayload & { email?: string },
  ) {
    // Pass email and purpose to service
    // For authenticated routes, email can be taken from JWT payload
    const email = dto.email || user?.email;
    if (!email) {
      throw new UnauthorizedException('Email is required for this action.');
    }
    return await this.authService.requestOtp(email);
  }

  @Post('verify-otp')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP',
    description:
      'Verify OTP to get a special-purpose token for subsequent actions like registration or password reset.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Returns a special-purpose token upon successful verification.',
  })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @CurrentUser() user?: JwtPayload & { email?: string },
  ) {
    const email = dto.email || user?.email;
    if (!email) {
      throw new UnauthorizedException('Email is required for this action.');
    }
    // This service call should return a short-lived, single-purpose token
    const result = await this.authService.verifyOtp(email, dto.otp);
    return { token: result.accessToken };
  }

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register a new user and auto-login' })
  @ApiResponse({
    status: 200,
    description: 'Returns Tokens or ChallengeRequiredResponse',
  })
  register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    void res;
    // Implementation goes here
    return { message: 'Register flow', data: dto };
  }

  @Post('login-with-social')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with social' })
  loginWithSocial(@Body() dto: LoginWithSocialDto) {
    void dto;
    // Handle social login integration
    return { message: 'Social login flow' };
  }

  @Post('login')
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // Stricter throttle for login
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Returns Tokens or ChallengeRequiredResponse',
  })
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    void res;
    // Implement login flow, check MFA, etc.
    return { message: 'Login flow', email: dto.email };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    void dto;
    // The service will validate the resetPasswordToken and update the password
    // await this.authService.resetPassword(dto.resetPasswordToken, dto.newPassword);
    return { success: true };
  }

  @Post('check-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check email exists' })
  checkEmail(@Body() dto: CheckEmailDto) {
    void dto;
    // const exists = await this.authService.checkEmailExists(dto.email);
    return { exists: false }; // Mock response
  }

  @Post('check-reference-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check reference code' })
  checkReferenceCode(@Body() dto: CheckReferenceCodeDto) {
    void dto;
    return { exists: true, isValid: true };
  }

  @Post('challenge')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create an auth challenge for sensitive purposes' })
  createChallenge(@Body() dto: AuthChallengeDto) {
    // Return ChallengeRequiredResponse
    return {
      challengeId: 'ch_' + Math.random().toString(36).substring(7),
      purpose: dto.purpose,
      requiredFactors: ['TOTP', 'EMAIL_OTP'],
      expiresAt: new Date(Date.now() + 5 * 60000).toISOString(),
    };
  }

  @Post('challenge/verify')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify Challenge' })
  verifyChallenge(@Body() dto: VerifyChallengeDto) {
    void dto;
    // Implement challenge verification
    return { success: true };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh token',
  })
  async refreshTokens(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token found');
    }

    try {
      const tokens = await this.authService.refreshAccessToken(refreshToken);
      res.cookie(
        'refresh_token',
        tokens.refreshToken,
        this.getRefreshCookieConfig(),
      );
      return { accessToken: tokens.accessToken };
    } catch {
      res.clearCookie('refresh_token');
      throw Object.assign(new UnauthorizedException('Session expired'), {
        code: 'session-expired',
      });
    }
  }

  @Post('change-password')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change Password' })
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: JwtPayload,
  ) {
    void dto;
    void user;
    // await this.authService.changePassword(user.sub, dto.oldPassword, dto.newPassword);
    return { success: true };
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;

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
