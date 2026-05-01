import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@/prisma/prisma.service';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';
import { MfaService } from './mfa.service';
import { Web3AuthService } from './web3-auth.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,
    private readonly mfaService: MfaService,
    private readonly web3AuthService: Web3AuthService,
  ) {}

  async issueTokenPair(
    user: { id: string; walletAddress?: string | null; role: string },
    session?: { deviceId?: string; userAgent?: string; ipAddress?: string },
  ) {
    return this.tokenService.issueTokenPair(user, session);
  }

  async refreshAccessToken(refreshToken: string) {
    return this.tokenService.refreshAccessToken(refreshToken);
  }

  async revokeRefreshToken(userId: string) {
    return this.tokenService.revokeRefreshToken(userId);
  }

  async revokeRefreshTokenByToken(token: string) {
    return this.tokenService.revokeRefreshTokenByToken(token);
  }

  async requestOtp(email: string) {
    return this.otpService.requestOtp(email);
  }

  async verifyOtp(email: string, otpCode: string, purpose: string) {
    return this.otpService.verifyOtp(email, otpCode, purpose);
  }

  async verifyRegisterToken(token: string) {
    return this.otpService.verifyRegisterToken(token);
  }

  async createWeb3Nonce(address?: string) {
    return this.web3AuthService.createWeb3Nonce(address);
  }

  async verifySignature(
    message: string,
    signature: string,
    nonce: string,
    walletAddress?: string,
    session?: { deviceId?: string; userAgent?: string; ipAddress?: string },
  ) {
    return this.web3AuthService.verifySignature(
      message,
      signature,
      nonce,
      walletAddress,
      session,
    );
  }

  async createChallenge(dto: any, user: any) {
    return this.mfaService.createChallenge(dto, user);
  }

  async verifyChallenge(dto: any, user: any) {
    return this.mfaService.verifyChallenge(dto, user);
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

    const tokens = await this.tokenService.issueTokenPair(user, session);
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

  // Check if email already exists
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

  // Check if username already exists
  async checkUsernameExists(username: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    return !!user;
  }

  // Create new user
  async createUser(data: {
    email: string;
    username?: string;
    password: string;
    referenceCode?: string;
    avatar?: string;
  }) {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Save user to DB
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
}
