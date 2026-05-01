/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unused-vars */
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
  ApiConsumes,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiOkResponse,
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
  VerifySignatureDto,
  Web3NonceDto,
} from '../dto/auth.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { JwtPayload } from '../types/jwt-payload.type';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import type { Response, Request } from 'express';
import { AppConfigService } from '@/config/app-config.service';

@ApiTags('Auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
  ) {}

  private getRefreshCookieConfig() {
    return {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'strict' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
  }

  private getDeviceContext(req: Request): {
    deviceId?: string;
    userAgent?: string;
    ipAddress?: string;
  } {
    const rawDeviceId = req.headers['x-device-id'];
    const rawUserAgent = req.headers['user-agent'];
    const deviceId =
      typeof rawDeviceId === 'string' && rawDeviceId.trim() !== ''
        ? rawDeviceId
        : undefined;
    return {
      deviceId,
      userAgent: typeof rawUserAgent === 'string' ? rawUserAgent : undefined,
      ipAddress: req.ip,
    };
  }

  @Post('send-otp')
  @ApiBearerAuth('accessToken')
  @Throttle({ short: { limit: 3, ttl: 300000 } })
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded', 'multipart/form-data')
  @ApiOperation({
    summary: 'Send OTP',
    description: 'Send a one-time password to the specified email for registration, password reset, withdrawal, or transfer verification.',
  })
  @ApiOkResponse({ description: 'OTP sent successfully.' })
  @ApiBadRequestResponse({ description: 'Invalid email address or unsupported purpose.' })
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
  @ApiBearerAuth('accessToken')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded', 'multipart/form-data')
  @ApiOperation({
    summary: 'Verify OTP',
    description:
      'Verify OTP to get a special-purpose token for subsequent actions like registration or password reset.',
  })
  @ApiOkResponse({
    description:
      'Returns a short-lived, single-purpose token upon successful OTP verification.',
  })
  @ApiBadRequestResponse({ description: 'OTP is invalid, expired, or email does not match.' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @CurrentUser() user?: JwtPayload & { email?: string },
  ) {
    const email = dto.email || user?.email;
    if (!email) {
      throw new UnauthorizedException('Email is required for this action.');
    }
    // This service call should return a short-lived, single-purpose token
    return this.authService.verifyOtp(email, dto.otp, dto.purpose);
  }

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded', 'multipart/form-data')
  @ApiOperation({
    summary: 'Register a new user and auto-login',
    description: 'Create a new user account using a verified register token from /auth/verify-otp. Returns JWT tokens or a challenge if MFA is required.',
  })
  @ApiOkResponse({
    description: 'Returns access token + user object, or ChallengeRequiredResponse when MFA is needed.',
  })
  @ApiBadRequestResponse({ description: 'Invalid register token, email already exists, or username taken.' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 1. Verify registerToken (assuming it's an accessToken returned from verifyOtp)
    let payload: any;
    try {
      payload = await this.authService.verifyRegisterToken(dto.registerToken);
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired register token');
    }

    // 2. Check if email already exists
    const email = payload.email;
    const existed = await this.authService.checkEmailExists(email);
    if (existed) {
      throw new UnauthorizedException('Email already registered');
    }

    // 3. Check username (if any)
    if (dto.username) {
      const usernameExisted = await this.authService.checkUsernameExists(
        dto.username,
      );
      if (usernameExisted) {
        throw new UnauthorizedException('Username already taken');
      }
    }

    // 4. Create new user
    const user = await this.authService.createUser({
      email,
      username: dto.username,
      password: dto.password,
      referenceCode: dto.referenceCode,
      avatar: dto.avatar,
    });

    // 5. Issue login token
    const tokens = await this.authService.issueTokenPair(
      user,
      this.getDeviceContext(req),
    );

    // 6. Set refresh token cookie
    res.cookie(
      'refresh_token',
      tokens.refreshToken,
      this.getRefreshCookieConfig(),
    );

    return {
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        walletAddress: user.walletAddress,
        avatar: user.avatar,
      },
    };
  }

  @Post('login-with-social')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded', 'multipart/form-data')
  @ApiOperation({
    summary: 'Login with social',
    description: 'Authenticate using a Google or Apple ID token from the React Native SDK.',
  })
  @ApiOkResponse({ description: 'Returns access token + user object on success.' })
  loginWithSocial(@Body() dto: LoginWithSocialDto, @Req() req: Request) {
    return this.authService.loginWithSocial(
      dto.provider,
      dto.idToken,
      this.getDeviceContext(req),
    );
  }

  @Post('web3/nonce')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({
    summary: 'Generate nonce for SIWE flow',
    description: 'Generate a one-time nonce to be embedded in the SIWE message before wallet signing.',
  })
  @ApiOkResponse({ description: 'Returns a random nonce string.' })
  getWeb3Nonce(@Body() dto: Web3NonceDto) {
    return this.authService.createWeb3Nonce(dto.walletAddress);
  }

  @Post('verify-signature')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({
    summary: 'Login/Register by wallet signature (SIWE)',
    description: 'Verify an EIP-4361 signature to authenticate or register a user via their Web3 wallet.',
  })
  @ApiOkResponse({ description: 'Returns access token + user object on success.' })
  @ApiBadRequestResponse({ description: 'Invalid signature, nonce mismatch, or expired nonce.' })
  async verifySignature(
    @Body() dto: VerifySignatureDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifySignature(
      dto.message,
      dto.signature,
      dto.nonce,
      dto.walletAddress,
      this.getDeviceContext(req),
    );
    res.cookie(
      'refresh_token',
      result.refreshToken,
      this.getRefreshCookieConfig(),
    );
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('login')
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // Stricter throttle for login
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded', 'multipart/form-data')
  @ApiOperation({
    summary: 'Login with email and password',
    description: 'Authenticate with email/password credentials. Returns JWT tokens or an MFA challenge if enabled.',
  })
  @ApiOkResponse({
    description: 'Returns access token + user object, or ChallengeRequiredResponse when MFA is needed.',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password.' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 1. Check if user exists
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 2. Issue token
    const tokens = await this.authService.issueTokenPair(
      user,
      this.getDeviceContext(req),
    );

    // 3. Set refresh token cookie
    res.cookie(
      'refresh_token',
      tokens.refreshToken,
      this.getRefreshCookieConfig(),
    );

    return {
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        walletAddress: user.walletAddress,
        avatar: user.avatar,
      },
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded', 'multipart/form-data')
  @ApiOperation({
    summary: 'Reset password',
    description: 'Reset the user password using a verified reset token from /auth/verify-otp.',
  })
  @ApiOkResponse({ description: 'Password reset successfully.' })
  @ApiBadRequestResponse({ description: 'Invalid or expired reset token.' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(
      dto.resetPasswordToken,
      dto.newPassword,
    );
    return { success: true };
  }

  @Post('check-email')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded', 'multipart/form-data')
  @ApiOperation({
    summary: 'Check email exists',
    description: 'Check whether the given email address is already registered in the system.',
  })
  @ApiOkResponse({ description: 'Returns { exists: boolean }.' })
  checkEmail(@Body() dto: CheckEmailDto) {
    return this.authService
      .checkEmailExists(dto.email)
      .then((exists) => ({ exists }));
  }

  @Post('check-reference-code')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded', 'multipart/form-data')
  @ApiOperation({
    summary: 'Check reference code',
    description: 'Validate whether a referral code exists and is eligible for use during registration.',
  })
  @ApiOkResponse({ description: 'Returns validity of the reference code.' })
  checkReferenceCode(@Body() dto: CheckReferenceCodeDto) {
    return this.authService.checkReferenceCode(dto.referenceCode);
  }

  @Post('challenge')
  @ApiBearerAuth('accessToken')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({
    summary: 'Create an auth challenge for sensitive purposes',
    description: 'Initiate an MFA challenge for a sensitive operation such as withdrawal or transfer. Returns a challengeId to be verified with the chosen MFA factor.',
  })
  @ApiOkResponse({ description: 'Returns challengeId and requiredFactors.' })
  async createChallenge(
    @Body() dto: AuthChallengeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Create authentication challenge (save to DB or cache, return challengeId, requiredFactors...)
    return await this.authService.createChallenge(dto, user);
  }

  @Post('challenge/verify')
  @ApiBearerAuth('accessToken')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({
    summary: 'Verify Challenge',
    description: 'Submit the MFA code (TOTP or Email OTP) to complete a challenge and receive a verified challengeId for downstream actions.',
  })
  @ApiOkResponse({ description: 'Returns verified challengeId on success.' })
  @ApiBadRequestResponse({ description: 'Invalid or expired MFA code.' })
  async verifyChallenge(
    @Body() dto: VerifyChallengeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Verify challenge (TOTP, Email OTP)
    return await this.authService.verifyChallenge(dto, user);
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
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded', 'multipart/form-data')
  @ApiOperation({
    summary: 'Change Password',
    description: 'Change the password for the currently authenticated user. Requires the old password for verification.',
  })
  @ApiOkResponse({ description: 'Password changed successfully.' })
  @ApiUnauthorizedResponse({ description: 'Old password is incorrect.' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.authService.changePassword(
      user.sub,
      dto.oldPassword,
      dto.newPassword,
    );
    return { success: true };
  }

  @Post('logout')
  @ApiBearerAuth('accessToken')
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
  @ApiBearerAuth('accessToken')
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
