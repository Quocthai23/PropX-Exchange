import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { ethers } from 'ethers';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from './types/jwt-payload.type';

const SIWE_DOMAIN = 'rwa-platform.com';
const SIWE_URI = 'https://rwa-platform.com';
const NONCE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async generateNonce(
    walletAddress: string,
  ): Promise<{ message: string; nonce: string }> {
    const address = walletAddress.toLowerCase();

    const nonce = crypto.randomBytes(16).toString('hex');
    const nonceExpiresAt = new Date(Date.now() + NONCE_TTL_MS);

    await this.prisma.user.upsert({
      where: { walletAddress: address },
      update: { nonce, nonceExpiresAt },
      create: { walletAddress: address, nonce, nonceExpiresAt },
    });

    const message = `${SIWE_DOMAIN} wants you to sign in with your Ethereum account:\n${walletAddress}\n\nWelcome to RWA Platform!\n\nURI: ${SIWE_URI}\nVersion: 1\nNonce: ${nonce}`;

    return { message, nonce };
  }

  async verifySignature(
    walletAddress: string,
    signature: string,
  ): Promise<{
    accessToken: string;
    user: { id: string; walletAddress: string };
  }> {
    const address = walletAddress.toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { walletAddress: address },
    });

    if (!user || !user.nonce) {
      throw new UnauthorizedException(
        'User not found or nonce has not been requested.',
      );
    }

    if (!user.nonceExpiresAt || user.nonceExpiresAt < new Date()) {
      throw new UnauthorizedException(
        'Nonce has expired. Please request a new nonce.',
      );
    }

    const message = `${SIWE_DOMAIN} wants you to sign in with your Ethereum account:\n${walletAddress}\n\nWelcome to RWA Platform!\n\nURI: ${SIWE_URI}\nVersion: 1\nNonce: ${user.nonce}`;

    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== address) {
        throw new UnauthorizedException('Invalid signature.');
      }

      await this.prisma.user.update({
        where: { walletAddress: address },
        data: { nonce: null, nonceExpiresAt: null },
      });
      const payload: JwtPayload = {
        sub: user.id,
        walletAddress: address,
        role: user.role,
      };
      const accessToken = await this.jwtService.signAsync(payload);
      return { accessToken, user: { id: user.id, walletAddress: address } };
    } catch {
      throw new UnauthorizedException('Signature verification failed.');
    }
  }
}
