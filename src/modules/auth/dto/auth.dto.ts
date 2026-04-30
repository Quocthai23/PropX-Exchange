import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  IsEthereumAddress,
} from 'class-validator';

const EMAIL_REGEX =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export class SendOtpDto {
  @ApiProperty({
    description: 'User email address. Required when register or reset password',
  })
  @IsEmail()
  @Matches(EMAIL_REGEX)
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    enum: ['register', 'reset_password', 'withdrawal', 'transfer'],
    description: 'Purpose of sending OTP',
  })
  @IsEnum(['register', 'reset_password', 'withdrawal', 'transfer'])
  purpose: string;
}

export class VerifyOtpDto {
  @ApiProperty({
    description: 'User email address. Required when register or reset password',
  })
  @IsEmail()
  @Matches(EMAIL_REGEX)
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: '6-digit numeric OTP',
    minLength: 6,
    maxLength: 6,
    pattern: '^\\d+$',
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d+$/)
  otp: string;

  @ApiProperty({
    enum: ['register', 'reset_password', 'withdrawal', 'transfer'],
  })
  @IsEnum(['register', 'reset_password', 'withdrawal', 'transfer'])
  purpose: string;
}

export class RegisterDto {
  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  registerToken: string;

  @ApiPropertyOptional({
    description: 'Username (3-100 characters)',
    minLength: 3,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  username?: string;

  @ApiProperty({
    description:
      'Register password (min 8 chars, mixed case, number, special char)',
    minLength: 8,
    pattern: PASSWORD_REGEX.source,
  })
  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_REGEX, {
    message:
      'Password must contain at least 1 lowercase, 1 uppercase, 1 number, and 1 special character.',
  })
  password: string;

  @ApiPropertyOptional({ description: 'Referral code', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  referenceCode?: string;

  @ApiPropertyOptional({ description: 'URL to user avatar image' })
  @IsOptional()
  @IsString()
  avatar?: string;
}

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    pattern: EMAIL_REGEX.source,
  })
  @Matches(EMAIL_REGEX, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  password: string;
}

export class AuthChallengeDto {
  @ApiProperty({
    enum: ['LOGIN', 'SETUP_MFA', 'DISABLE_MFA', 'WITHDRAW', 'TRANSFER'],
  })
  @IsEnum(['LOGIN', 'SETUP_MFA', 'DISABLE_MFA', 'WITHDRAW', 'TRANSFER'])
  purpose: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  payload?: Record<string, any>;
}

export class ResetPasswordDto {
  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  resetPasswordToken: string;

  @ApiProperty({
    description: 'New password (min 8 chars, mixed case, number, special char)',
    minLength: 8,
    pattern: PASSWORD_REGEX.source,
  })
  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_REGEX)
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  oldPassword: string;

  @ApiProperty({
    description: 'New password (min 8 chars, mixed case, number, special char)',
    minLength: 8,
    pattern: PASSWORD_REGEX.source,
  })
  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_REGEX)
  newPassword: string;
}

export class CheckEmailDto {
  @ApiProperty({
    description: 'User email address',
    pattern: EMAIL_REGEX.source,
  })
  @IsEmail()
  @Matches(EMAIL_REGEX)
  email: string;
}

export class LoginWithSocialDto {
  @ApiProperty({
    enum: ['google', 'apple'],
    description: 'Social provider: google or apple',
  })
  @IsEnum(['google', 'apple'])
  provider: string;

  @ApiProperty({
    minLength: 1,
    description: 'ID token from social provider (React Native app)',
  })
  @IsString()
  @MinLength(1)
  idToken: string;
}

export class CheckReferenceCodeDto {
  @ApiProperty({ description: 'Referral code', minLength: 1, maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  referenceCode: string;
}

export class VerifyChallengeDto {
  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  challengeId: string;

  @ApiProperty({ enum: ['TOTP', 'EMAIL_OTP'] })
  @IsEnum(['TOTP', 'EMAIL_OTP'])
  factor: string;

  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  code: string;
}

export class VerifySignatureDto {
  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  message: string;

  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  signature: string;

  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  nonce: string;

  @ApiPropertyOptional({
    description: 'Wallet address to cross-check ownership',
  })
  @IsOptional()
  @IsString()
  @IsEthereumAddress()
  walletAddress?: string;
}

export class Web3NonceDto {
  @ApiPropertyOptional({ description: 'Optional wallet address' })
  @IsOptional()
  @IsString()
  @IsEthereumAddress()
  walletAddress?: string;
}
