/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { ethers } from 'ethers';
import * as nodemailer from 'nodemailer';
import { createHash } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from './encryption.service';
import type { JwtPayload } from '../types/jwt-payload.type';

@Injectable()
export class AuthService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTokenSecret =
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || '';
  private readonly refreshTokenExpiresIn =
    process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly encryptionService: EncryptionService,
  ) {
    if (!this.refreshTokenSecret) {
      throw new Error('JWT_SECRET or JWT_REFRESH_SECRET is required');
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getRefreshTokenExpiryDate(): Date {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  async issueTokenPair(user: {
    id: string;
    walletAddress: string;
    role: string;
  }): Promise<{ accessToken: string; refreshToken: string }> {
    const accessPayload: JwtPayload = {
      sub: user.id,
      walletAddress: user.walletAddress,
      role: user.role as JwtPayload['role'],
    };

    const refreshPayload: { sub: string; type: 'refresh' } = {
      sub: user.id,
      type: 'refresh',
    };

    const refreshTokenOptions: JwtSignOptions = {
      secret: this.refreshTokenSecret,
      expiresIn: this.refreshTokenExpiresIn as JwtSignOptions['expiresIn'],
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload),
      this.jwtService.signAsync(refreshPayload, refreshTokenOptions),
    ]);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: this.hashToken(refreshToken),
        refreshTokenExpiresAt: this.getRefreshTokenExpiryDate(),
      },
    });

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

    try {
      await this.transporter.sendMail({
        from: `"RWA Platform Admin" <${process.env.SMTP_USER}>`,
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
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; walletAddress: string };
  }> {
    const otpRecord = await this.prisma.otp.findUnique({ where: { email } });

    if (!otpRecord || otpRecord.code !== otpCode) {
      throw new UnauthorizedException('Invalid OTP code.');
    }

    if (otpRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('OTP code has expired.');
    }

    await this.prisma.otp.delete({ where: { email } });

    let user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        walletAddress: true,
        role: true,
      },
    });

    if (!user) {
      const wallet = ethers.Wallet.createRandom();

      const encryptedPrivateKey = this.encryptionService.encrypt(
        wallet.privateKey,
      );

      user = await this.prisma.user.create({
        data: {
          email,
          walletAddress: wallet.address,
          encryptedPrivateKey,
        },
        select: {
          id: true,
          email: true,
          walletAddress: true,
          role: true,
        },
      });
    }

    const { accessToken, refreshToken } = await this.issueTokenPair(user);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
      },
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    let payload: { sub: string; type?: string };

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
      },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token not found');
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

    return this.issueTokenPair(user);
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
      // Có thể dùng jwtService.verifyAsync, tuỳ logic có thể kiểm tra thêm purpose
      return await this.jwtService.verifyAsync(token);
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired register token');
    }
  }

  // Kiểm tra email đã tồn tại chưa
  async checkEmailExists(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return !!user;
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
    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Tạo ví mới cho user
    const wallet = ethers.Wallet.createRandom();
    const encryptedPrivateKey = this.encryptionService.encrypt(
      wallet.privateKey,
    );

    // Lưu user vào DB
    return this.prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: hashedPassword,
        referenceCode: data.referenceCode,
        avatar: data.avatar,
        walletAddress: wallet.address,
        encryptedPrivateKey,
      },
    });
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return null;
    const bcrypt = require('bcryptjs');
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
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { email }, data: { passwordHash: hashedPassword } });
  }

  async createChallenge(dto: any, user: any) {
    const challengeId = 'ch_' + Math.random().toString(36).substring(2, 10);
    return {
      challengeId,
      purpose: dto.purpose,
      requiredFactors: ['TOTP', 'EMAIL_OTP'],
      expiresAt: new Date(Date.now() + 5 * 60000).toISOString(),
    };
  }

  async verifyChallenge(dto: any, user: any) {
    if (dto.factor === 'EMAIL_OTP') {
      const email = user.email;
      const otpRecord = await this.prisma.otp.findUnique({ where: { email } });
      if (!otpRecord || otpRecord.code !== dto.code) {
        throw new UnauthorizedException('Invalid OTP code.');
      }
      if (otpRecord.expiresAt < new Date()) {
        throw new UnauthorizedException('OTP code has expired.');
      }
      await this.prisma.otp.delete({ where: { email } });
      return { success: true, factor: 'EMAIL_OTP' };
    } else if (dto.factor === 'TOTP') {
      const speakeasy = require('speakeasy');
      const userRecord = await this.prisma.user.findUnique({ where: { id: user.sub } });
      if (!userRecord) {
        throw new UnauthorizedException('User not found');
      }
      return { success: true, factor: 'TOTP' };
    } else {
      throw new UnauthorizedException('Unsupported factor');
    }
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('User not found');
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) throw new UnauthorizedException('Old password is incorrect');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hashedPassword } });
  }
}
