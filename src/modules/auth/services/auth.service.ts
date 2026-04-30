/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
  Logger,
  ForbiddenException,
  BadRequestException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as nodemailer from 'nodemailer';
import { createHash } from 'crypto';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import { SiweMessage } from 'siwe';
import { createClient, type RedisClientType } from 'redis';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '../types/jwt-payload.type';
import { AppConfigService } from '@/config/app-config.service';

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private transporter: nodemailer.Transporter | null;
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTokenSecret: string;
  private readonly refreshTokenExpiresIn: string;
  private readonly registerTokenExpiresIn = '15m';
  private readonly redisClient: RedisClientType;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
  ) {
    this.refreshTokenSecret =
      this.config.jwtRefreshSecret ?? this.config.jwtSecret ?? '';
    this.refreshTokenExpiresIn = this.config.jwtRefreshExpiresIn ?? '7d';

    if (!this.refreshTokenSecret) {
      throw new Error('JWT_SECRET is required');
    }

    const smtpHost = this.config.smtpHost ?? 'smtp.gmail.com';
    const smtpPort = this.config.smtpPort ?? 587;
    const smtpUser = this.config.smtpUser;
    const smtpPass = this.config.smtpPass;

    if (!smtpUser || !smtpPass) {
      this.transporter = null;
      this.logger.warn(
        'SMTP credentials are not configured. OTP emails are disabled.',
      );
    } else {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: false,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
    }

    this.redisClient = createClient({
      socket: {
        host: this.config.redisHost,
        port: this.config.redisPort,
      },
      password: this.config.redisPassword,
    });
    this.redisClient.on('error', (error) => {
      this.logger.error('Redis connection error', error);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.redisClient.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient.isOpen) {
      await this.redisClient.disconnect();
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getRefreshTokenExpiryDate(): Date {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  async issueTokenPair(
    user: {
      id: string;
      walletAddress?: string | null;
      role: string;
    },
    session?: {
      deviceId?: string;
      userAgent?: string;
      ipAddress?: string;
    },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessPayload: JwtPayload = {
      sub: user.id,
      walletAddress: user.walletAddress ?? null,
      role: user.role as JwtPayload['role'],
    };

    const sessionId = session?.deviceId ?? randomUUID();
    const refreshPayload: { sub: string; type: 'refresh' } = {
      sub: user.id,
      type: 'refresh',
    };
    const fullRefreshPayload = {
      ...refreshPayload,
      sid: sessionId,
    };

    const refreshTokenOptions: JwtSignOptions = {
      secret: this.refreshTokenSecret,
      expiresIn: this.refreshTokenExpiresIn as JwtSignOptions['expiresIn'],
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload),
      this.jwtService.signAsync(fullRefreshPayload, refreshTokenOptions),
    ]);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: this.hashToken(refreshToken),
        refreshTokenExpiresAt: this.getRefreshTokenExpiryDate(),
      },
    });

    if (session?.deviceId) {
      await this.prisma.deviceSession.upsert({
        where: {
          userId_deviceId: {
            userId: user.id,
            deviceId: session.deviceId,
          },
        },
        update: {
          refreshTokenHash: this.hashToken(refreshToken),
          refreshTokenExpiresAt: this.getRefreshTokenExpiryDate(),
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          lastSeenAt: new Date(),
        },
        create: {
          userId: user.id,
          deviceId: session.deviceId,
          refreshTokenHash: this.hashToken(refreshToken),
          refreshTokenExpiresAt: this.getRefreshTokenExpiryDate(),
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          lastSeenAt: new Date(),
        },
      });
    }

    return { accessToken, refreshToken };
  }

  async requestOtp(email: string): Promise<{ message: string }> {
    const existingOtp = await this.prisma.otp.findUnique({ where: { email } });
    if (existingOtp && existingOtp.expiresAt > new Date()) {
      throw new HttpException(
        'A previous OTP is still valid. Please check your email or try again after it expires (5 minutes).',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.prisma.otp.upsert({
      where: { email },
      update: { code: otpCode, expiresAt },
      create: { email, code: otpCode, expiresAt },
    });

    if (!this.transporter) {
      throw new InternalServerErrorException('SMTP is not configured.');
    }

    try {
      await this.transporter.sendMail({
        from: `"RWA Platform Admin" <${this.config.smtpUser}>`,
        to: email,
        subject: 'RWA Platform login verification code',
        text: `Your OTP code is: ${otpCode}. This code will expire in 5 minutes.`,
        html: `<p>Your OTP code is: <b>${otpCode}</b></p><p>This code will expire in 5 minutes.</p>`,
      });
      return { message: 'OTP code has been sent to your email.' };
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      throw new InternalServerErrorException('Unable to send OTP email.');
    }
  }

  async verifyOtp(
    email: string,
    otpCode: string,
    purpose: string,
  ): Promise<{ token: string }> {
    const otpRecord = await this.prisma.otp.findUnique({ where: { email } });

    if (!otpRecord || otpRecord.code !== otpCode) {
      throw new UnauthorizedException('Invalid OTP code.');
    }

    if (otpRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('OTP code has expired.');
    }

    await this.prisma.otp.delete({ where: { email } });

    if (purpose === 'register') {
      const registerToken = await this.jwtService.signAsync(
        { email, purpose: 'register', type: 'register' },
        { expiresIn: this.registerTokenExpiresIn },
      );
      return { token: registerToken };
    }

    if (purpose === 'reset_password') {
      const resetPasswordToken = await this.jwtService.signAsync(
        { email, purpose: 'reset_password', type: 'reset_password' },
        { expiresIn: '15m' },
      );
      return { token: resetPasswordToken };
    }

    const otpToken = await this.jwtService.signAsync(
      { email, purpose, type: 'otp_verified' },
      { expiresIn: '10m' },
    );

    return { token: otpToken };
  }

  async loginWithSocial(
    provider: string,
    idToken: string,
    session?: {
      deviceId?: string;
      userAgent?: string;
      ipAddress?: string;
    },
  ) {
    const decoded = this.jwtService.decode(idToken) as {
      email?: string;
      sub?: string;
      name?: string;
      picture?: string;
    } | null;

    if (!decoded) {
      throw new UnauthorizedException('Invalid social token');
    }

    const socialSub = decoded.sub?.trim();
    if (!socialSub) {
      throw new UnauthorizedException('Social token subject is missing');
    }

    const normalizedProvider = provider.toLowerCase();
    const email =
      decoded.email?.toLowerCase().trim() ||
      `${normalizedProvider}_${socialSub}@social.local`;

    let user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        walletAddress: true,
        avatar: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          username:
            decoded.name?.trim() || `${normalizedProvider}_${socialSub}`,
          avatar: decoded.picture,
          walletAddress: null,
        },
        select: {
          id: true,
          email: true,
          username: true,
          walletAddress: true,
          avatar: true,
          role: true,
          status: true,
        },
      });
    }
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Account is locked');
    }

    const tokens = await this.issueTokenPair(user, session);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        walletAddress: user.walletAddress ?? null,
        avatar: user.avatar,
      },
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    let payload: { sub: string; type?: string; sid?: string };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.refreshTokenSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token expired or invalid');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        walletAddress: true,
        role: true,
        refreshTokenHash: true,
        refreshTokenExpiresAt: true,
        status: true,
      },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token not found');
    }
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Account is locked');
    }

    if (
      user.refreshTokenExpiresAt &&
      user.refreshTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const incomingTokenHash = this.hashToken(refreshToken);
    if (user.refreshTokenHash !== incomingTokenHash) {
      throw new UnauthorizedException('Refresh token does not match');
    }

    if (payload.sid) {
      const session = await this.prisma.deviceSession.findUnique({
        where: {
          userId_deviceId: {
            userId: user.id,
            deviceId: payload.sid,
          },
        },
      });
      if (!session) {
        throw new UnauthorizedException('Session not found');
      }
      if (session.refreshTokenHash !== incomingTokenHash) {
        throw new UnauthorizedException('Session refresh token mismatch');
      }
      if (session.refreshTokenExpiresAt.getTime() < Date.now()) {
        throw new UnauthorizedException('Session expired');
      }
    }

    return this.issueTokenPair(
      user,
      payload.sid ? { deviceId: payload.sid } : undefined,
    );
  }

  async revokeRefreshToken(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });
  }

  async revokeRefreshTokenByToken(token: string): Promise<void> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        type?: string;
      }>(token, { secret: this.refreshTokenSecret });

      if (payload.type === 'refresh') {
        await this.revokeRefreshToken(payload.sub);
      }
    } catch {
      // Ignore invalid/expired token during logout to keep endpoint idempotent.
    }
  }

  // Xác thực registerToken (thường là accessToken trả về từ verifyOtp, chứa email)
  async verifyRegisterToken(token: string): Promise<any> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        email?: string;
        purpose?: string;
        type?: string;
      }>(token);
      if (
        !payload.email ||
        payload.purpose !== 'register' ||
        payload.type !== 'register'
      ) {
        throw new UnauthorizedException('Invalid register token');
      }
      return payload;
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired register token');
    }
  }

  // Kiểm tra email đã tồn tại chưa
  async checkEmailExists(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return !!user;
  }

  async checkReferenceCode(referenceCode: string): Promise<{
    exists: boolean;
    isValid: boolean;
  }> {
    const code = referenceCode.trim();
    if (!code) {
      return { exists: false, isValid: false };
    }

    const owner = await this.prisma.user.findUnique({
      where: { referenceCode: code },
      select: { id: true, status: true },
    });

    if (!owner) {
      return { exists: false, isValid: false };
    }

    return {
      exists: true,
      isValid: owner.status === 'ACTIVE',
    };
  }

  // Kiểm tra username đã tồn tại chưa
  async checkUsernameExists(username: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    return !!user;
  }

  // Tạo user mới
  async createUser(data: {
    email: string;
    username?: string;
    password: string;
    referenceCode?: string;
    avatar?: string;
  }) {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Lưu user vào DB
    return this.prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: hashedPassword,
        referenceCode: data.referenceCode,
        avatar: data.avatar,
        walletAddress: null,
      },
    });
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return null;
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Account is locked');
    }
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return null;
    return user;
  }

  async resetPassword(resetPasswordToken: string, newPassword: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(resetPasswordToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
    const email = payload.email;
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('User not found');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { email },
      data: { passwordHash: hashedPassword },
    });
  }

  async createChallenge(dto: any, user: any) {
    const challengeId = 'ch_' + Math.random().toString(36).substring(2, 10);
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { email: true },
    });
    const challengePayload = {
      challengeId,
      userId: user.sub,
      email: userRecord?.email,
      purpose: dto.purpose,
      requiredFactors: ['TOTP', 'EMAIL_OTP'],
      expiresAt: new Date(Date.now() + 5 * 60000).toISOString(),
      used: false,
    };
    await this.redisClient.set(
      `auth:challenge:${challengeId}`,
      JSON.stringify(challengePayload),
      { EX: 5 * 60 },
    );
    return {
      challengeId: challengePayload.challengeId,
      purpose: challengePayload.purpose,
      requiredFactors: challengePayload.requiredFactors,
      expiresAt: challengePayload.expiresAt,
    };
  }

  async verifyChallenge(dto: any, user: any) {
    const challengeRaw = await this.redisClient.get(
      `auth:challenge:${dto.challengeId}`,
    );
    if (!challengeRaw) {
      throw new UnauthorizedException('Challenge not found or expired');
    }
    const challenge = JSON.parse(challengeRaw) as {
      challengeId: string;
      userId: string;
      email?: string;
      used: boolean;
    };
    if (challenge.userId !== user.sub) {
      throw new UnauthorizedException('Challenge does not belong to user');
    }
    if (challenge.used) {
      throw new UnauthorizedException('Challenge already used');
    }

    if (dto.factor === 'EMAIL_OTP') {
      const email = challenge.email ?? user.email;
      const otpRecord = await this.prisma.otp.findUnique({ where: { email } });
      if (!otpRecord || otpRecord.code !== dto.code) {
        throw new UnauthorizedException('Invalid OTP code.');
      }
      if (otpRecord.expiresAt < new Date()) {
        throw new UnauthorizedException('OTP code has expired.');
      }
      await this.prisma.otp.delete({ where: { email } });
      await this.redisClient.del(`auth:challenge:${dto.challengeId}`);
      return { success: true, factor: 'EMAIL_OTP' };
    } else if (dto.factor === 'TOTP') {
      const userRecord = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { id: true, enabledMfa: true, mfaSecret: true },
      });
      if (!userRecord) {
        throw new UnauthorizedException('User not found');
      }
      if (!userRecord.enabledMfa || !userRecord.mfaSecret) {
        throw new UnauthorizedException('MFA is not enabled');
      }
      const verified = speakeasy.totp.verify({
        secret: userRecord.mfaSecret,
        token: dto.code,
        encoding: 'base32',
        window: 1,
      });
      if (!verified) {
        throw new UnauthorizedException('Invalid TOTP code');
      }
      await this.redisClient.del(`auth:challenge:${dto.challengeId}`);
      return { success: true, factor: 'TOTP' };
    } else {
      throw new UnauthorizedException('Unsupported factor');
    }
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash)
      throw new UnauthorizedException('User not found');
    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) throw new UnauthorizedException('Old password is incorrect');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });
  }

  async createWeb3Nonce(address?: string): Promise<{ nonce: string }> {
    const nonce = randomUUID().replace(/-/g, '');
    await this.redisClient.set(`auth:web3:nonce:${nonce}`, nonce, {
      EX: 5 * 60,
    });
    if (address) {
      await this.redisClient.set(
        `auth:web3:nonce:addr:${address.toLowerCase()}`,
        nonce,
        { EX: 5 * 60 },
      );
    }
    return { nonce };
  }

  async verifySignature(
    message: string,
    signature: string,
    nonce: string,
    walletAddress?: string,
    session?: {
      deviceId?: string;
      userAgent?: string;
      ipAddress?: string;
    },
  ) {
    const parsedMessage = new SiweMessage(message);
    const verificationResult = await parsedMessage.verify({ signature, nonce });
    if (!verificationResult.success) {
      throw new UnauthorizedException('Invalid signature');
    }

    const resolvedAddress = parsedMessage.address.toLowerCase();
    if (walletAddress && resolvedAddress !== walletAddress.toLowerCase()) {
      throw new BadRequestException('Wallet address mismatch');
    }

    const nonceByAddress = await this.redisClient.get(
      `auth:web3:nonce:addr:${resolvedAddress}`,
    );
    const nonceInRedis =
      nonceByAddress ??
      (await this.redisClient.get(`auth:web3:nonce:${nonce}`));
    if (!nonceInRedis || nonceInRedis !== nonce) {
      throw new UnauthorizedException('Invalid or expired nonce');
    }
    await Promise.all([
      this.redisClient.del(`auth:web3:nonce:addr:${resolvedAddress}`),
      this.redisClient.del(`auth:web3:nonce:${nonce}`),
    ]);

    let user = await this.prisma.user.findFirst({
      where: { walletAddress: resolvedAddress },
      select: {
        id: true,
        email: true,
        username: true,
        walletAddress: true,
        avatar: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: `wallet_${resolvedAddress}@wallet.local`,
          walletAddress: resolvedAddress,
          username: `wallet_${resolvedAddress.slice(2, 10)}`,
        },
        select: {
          id: true,
          email: true,
          username: true,
          walletAddress: true,
          avatar: true,
          role: true,
          status: true,
        },
      });
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Account is locked');
    }

    const tokens = await this.issueTokenPair(user, session);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        walletAddress: user.walletAddress ?? null,
        avatar: user.avatar,
      },
    };
  }
}
