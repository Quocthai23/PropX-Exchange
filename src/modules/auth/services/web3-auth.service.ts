import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthRedisService } from './auth-redis.service';
import { TokenService } from './token.service';
import { randomUUID } from 'node:crypto';
import { SiweMessage } from 'siwe';

@Injectable()
export class Web3AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authRedis: AuthRedisService,
    private readonly tokenService: TokenService,
  ) {}

  async createWeb3Nonce(address?: string): Promise<{ nonce: string }> {
    const nonce = randomUUID().replace(/-/g, '');
    const redisClient = this.authRedis.getClient();
    await redisClient.set(`auth:web3:nonce:${nonce}`, nonce, {
      EX: 5 * 60,
    });
    if (address) {
      await redisClient.set(
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

    const redisClient = this.authRedis.getClient();
    const nonceByAddress = await redisClient.get(
      `auth:web3:nonce:addr:${resolvedAddress}`,
    );
    const nonceInRedis =
      nonceByAddress ??
      (await redisClient.get(`auth:web3:nonce:${nonce}`));
    if (!nonceInRedis || nonceInRedis !== nonce) {
      throw new UnauthorizedException('Invalid or expired nonce');
    }
    await Promise.all([
      redisClient.del(`auth:web3:nonce:addr:${resolvedAddress}`),
      redisClient.del(`auth:web3:nonce:${nonce}`),
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
}
