import {
  Injectable,
  Logger,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '@/prisma/prisma.service';
import { AppConfigService } from '@/config/app-config.service';

@Injectable()
export class OtpService {
  private transporter: nodemailer.Transporter | null;
  private readonly logger = new Logger(OtpService.name);
  private readonly registerTokenExpiresIn = '15m';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
  ) {
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

  // Verify registerToken (usually accessToken returned from verifyOtp, containing email)
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
}
