import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from '../services/auth.service';
import { AuthController } from '../controllers/auth.controller';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../services/encryption.service';
import { ThrottlerModule } from '@nestjs/throttler';

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET is required');
}

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: jwtSecret,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, EncryptionService],
})
export class AuthModule {}

