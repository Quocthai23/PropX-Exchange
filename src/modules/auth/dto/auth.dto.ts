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
    description: 'User email address. Required for registration or password reset.',
    example: 'user@example.com',
    pattern: EMAIL_REGEX.source,
    format: 'email',
  })
  @IsEmail()
  @Matches(EMAIL_REGEX)
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    enum: ['register', 'reset_password', 'withdrawal', 'transfer'],
    description: 'Purpose of sending OTP. Determines the downstream action after verification.',
    example: 'register',
  })
  @IsEnum(['register', 'reset_password', 'withdrawal', 'transfer'])
  purpose: string;
}

export class VerifyOtpDto {
  @ApiProperty({
    description: 'User email address that the OTP was sent to.',
    example: 'user@example.com',
    pattern: EMAIL_REGEX.source,
    format: 'email',
  })
  @IsEmail()
  @Matches(EMAIL_REGEX)
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: '6-digit numeric One-Time Password sent to the email.',
    example: '123456',
    minLength: 6,
    maxLength: 6,
    pattern: '^\\d{6}$',
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d+$/)
  otp: string;

  @ApiProperty({
    enum: ['register', 'reset_password', 'withdrawal', 'transfer'],
    description: 'Purpose of the OTP — must match the purpose used in send-otp.',
    example: 'register',
  })
  @IsEnum(['register', 'reset_password', 'withdrawal', 'transfer'])
  purpose: string;
}

export class RegisterDto {
  @ApiProperty({
    description: 'Short-lived registration token returned by /auth/verify-otp. Proves the user owns the email.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  registerToken: string;

  @ApiPropertyOptional({
    description: 'Desired username. Must be 3-100 characters, containing only letters, numbers, and underscores.',
    example: 'john_doe_99',
    minLength: 3,
    maxLength: 100,
    pattern: '^[A-Za-z0-9_]+$',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  username?: string;

  @ApiProperty({
    description:
      'Account password. Min 8 characters — must include at least 1 lowercase, 1 uppercase, 1 digit, and 1 special character.',
    example: 'P@ssword1!',
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

  @ApiPropertyOptional({
    description: 'Referral code of the user who invited this account.',
    example: 'REF-ABC123',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  referenceCode?: string;

  @ApiPropertyOptional({
    description: 'Publicly accessible URL to the user avatar image.',
    example: 'https://cdn.example.com/avatars/user123.jpg',
    format: 'uri',
  })
  @IsOptional()
  @IsString()
  avatar?: string;
}

export class LoginDto {
  @ApiProperty({
    description: 'Registered email address of the user.',
    example: 'user@example.com',
    pattern: EMAIL_REGEX.source,
    format: 'email',
  })
  @Matches(EMAIL_REGEX, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({
    description: 'User account password.',
    example: 'P@ssword1!',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  password: string;
}

export class AuthChallengeDto {
  @ApiProperty({
    enum: ['LOGIN', 'SETUP_MFA', 'DISABLE_MFA', 'WITHDRAW', 'TRANSFER'],
    description: 'Sensitive action purpose that requires an MFA challenge.',
    example: 'WITHDRAW',
  })
  @IsEnum(['LOGIN', 'SETUP_MFA', 'DISABLE_MFA', 'WITHDRAW', 'TRANSFER'])
  purpose: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Optional context payload attached to the challenge (e.g. withdrawal details).',
    example: { amount: '100', destinationAddress: '0xABC...' },
  })
  @IsOptional()
  payload?: Record<string, any>;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Short-lived password-reset token returned by /auth/verify-otp.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  resetPasswordToken: string;

  @ApiProperty({
    description:
      'New password. Min 8 characters — must include at least 1 lowercase, 1 uppercase, 1 digit, and 1 special character.',
    example: 'NewP@ss99!',
    minLength: 8,
    pattern: PASSWORD_REGEX.source,
  })
  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_REGEX)
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current (old) password of the authenticated user.',
    example: 'OldP@ss1!',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  oldPassword: string;

  @ApiProperty({
    description:
      'New password. Min 8 characters — must include at least 1 lowercase, 1 uppercase, 1 digit, and 1 special character.',
    example: 'NewP@ss99!',
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
    description: 'Email address to check for existing registration.',
    example: 'user@example.com',
    pattern: EMAIL_REGEX.source,
    format: 'email',
  })
  @IsEmail()
  @Matches(EMAIL_REGEX)
  email: string;
}

export class LoginWithSocialDto {
  @ApiProperty({
    enum: ['google', 'apple'],
    description: 'Social identity provider to authenticate with.',
    example: 'google',
  })
  @IsEnum(['google', 'apple'])
  provider: string;

  @ApiProperty({
    description: 'ID token issued by the social provider (obtained from React Native SDK).',
    example: 'ya29.a0AfH6SMC...',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  idToken: string;
}

export class CheckReferenceCodeDto {
  @ApiProperty({
    description: 'Referral code to validate before using it during registration.',
    example: 'REF-ABC123',
    minLength: 1,
    maxLength: 50,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  referenceCode: string;
}

export class VerifyChallengeDto {
  @ApiProperty({
    description: 'Challenge ID returned by POST /auth/challenge.',
    example: 'chal_01J2XABCDEF123',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  challengeId: string;

  @ApiProperty({
    enum: ['TOTP', 'EMAIL_OTP'],
    description: 'MFA factor used to complete the challenge.',
    example: 'TOTP',
  })
  @IsEnum(['TOTP', 'EMAIL_OTP'])
  factor: string;

  @ApiProperty({
    description: 'The OTP or TOTP code for the chosen factor.',
    example: '654321',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  code: string;
}

export class VerifySignatureDto {
  @ApiProperty({
    description: 'EIP-4361 (SIWE) formatted message that was signed by the wallet.',
    example: 'example.com wants you to sign in with your Ethereum account...',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  message: string;

  @ApiProperty({
    description: 'Hex-encoded ECDSA signature produced by the wallet over the message.',
    example: '0x4f3a...deadbeef',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  signature: string;

  @ApiProperty({
    description: 'Random nonce previously issued by GET /auth/web3/nonce to prevent replay attacks.',
    example: 'nonce_01J2XAB',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  nonce: string;

  @ApiPropertyOptional({
    description: 'EVM wallet address to cross-check ownership (checksummed, 0x-prefixed).',
    example: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    pattern: '^0x[a-fA-F0-9]{40}$',
  })
  @IsOptional()
  @IsString()
  @IsEthereumAddress()
  walletAddress?: string;
}

export class Web3NonceDto {
  @ApiPropertyOptional({
    description: 'Optional EVM wallet address to scope the nonce (checksummed, 0x-prefixed).',
    example: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    pattern: '^0x[a-fA-F0-9]{40}$',
  })
  @IsOptional()
  @IsString()
  @IsEthereumAddress()
  walletAddress?: string;
}
