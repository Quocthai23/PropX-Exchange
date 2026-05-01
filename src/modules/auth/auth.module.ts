import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { OtpService } from './services/otp.service';
import { MfaService } from './services/mfa.service';
import { Web3AuthService } from './services/web3-auth.service';
import { AuthRedisService } from './services/auth-redis.service';
import { AuthController } from './controllers/auth.controller';
import { PrismaService } from '@/prisma/prisma.service';
import { AppConfigService } from '@/config/app-config.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.jwtSecret,
        signOptions: { expiresIn: '1d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    OtpService,
    MfaService,
    Web3AuthService,
    AuthRedisService,
    PrismaService,
  ],
})
export class AuthModule {}
