import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { GenerateNonceDto, VerifySignatureDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { JwtPayload } from './types/jwt-payload.type';

@ApiTags('1. Auth - Web3 Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('nonce')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a nonce for wallet address' })
  @ApiResponse({
    status: 200,
    description: 'Return message string containing nonce to sign',
  })
  async getNonce(@Body() dto: GenerateNonceDto) {
    return this.authService.generateNonce(dto.walletAddress);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify signature and get JWT Token' })
  @ApiResponse({
    status: 200,
    description: 'Login successful, return JWT Token',
  })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  async verifySignature(@Body() dto: VerifySignatureDto) {
    return this.authService.verifySignature(dto.walletAddress, dto.signature);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile (Requires JWT Token)' })
  @ApiResponse({
    status: 200,
    description: 'Return user info from token payload',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  getProfile(@CurrentUser() user: JwtPayload) {
    return { message: 'Authentication successful!', user };
  }
}
