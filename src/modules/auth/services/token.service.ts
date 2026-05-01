import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '../types/jwt-payload.type';
import { AppConfigService } from '@/config/app-config.service';

@Injectable()
export class TokenService {
  private readonly refreshTokenSecret: string;
  private readonly refreshTokenExpiresIn: string;

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
}
