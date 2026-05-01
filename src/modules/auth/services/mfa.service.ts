import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthRedisService } from './auth-redis.service';
import * as speakeasy from 'speakeasy';

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authRedis: AuthRedisService,
  ) {}

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
    const redisClient = this.authRedis.getClient();
    await redisClient.set(
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
    const redisClient = this.authRedis.getClient();
    const challengeRaw = await redisClient.get(`auth:challenge:${dto.challengeId}`);
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
      await redisClient.del(`auth:challenge:${dto.challengeId}`);
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
      await redisClient.del(`auth:challenge:${dto.challengeId}`);
      return { success: true, factor: 'TOTP' };
    } else {
      throw new UnauthorizedException('Unsupported factor');
    }
  }
}
