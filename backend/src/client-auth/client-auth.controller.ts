import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ClientAuthService } from './client-auth.service';
import { AuthRateLimitService } from '../auth/auth-rate-limit.service';
import { ClientLoginDto } from './dto/client-login.dto';
import { ClientRegisterDto } from './client-auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtRefreshGuard } from '../auth/guards/jwt-refresh.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { VerifyOtpDto } from '../email-verification/dto/verify-otp.dto';
import { ResendOtpDto } from '../email-verification/dto/resend-otp.dto';

@Controller('client-auth')
export class ClientAuthController {
  constructor(
    private readonly clientAuthService: ClientAuthService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: ClientLoginDto, @Req() req: Request) {
    this.throttle(req, 'login', dto.email, 10, 900);
    return this.clientAuthService.login(dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    this.throttle(req, 'verify-email', dto.email, 10, 900);
    return this.clientAuthService.verifyEmail(dto);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  resendOtp(@Body() dto: ResendOtpDto, @Req() req: Request) {
    this.throttle(req, 'resend-otp', dto.email, 10, 900);
    return this.clientAuthService.resendOtp(dto);
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refreshTokens(@Req() req: Request) {
    const user = req.user as unknown as ActiveUser & { refreshToken: string };
    return this.clientAuthService.refreshTokens(user.sub, user.refreshToken);
  }

  @Post('register')
  register(@Body() dto: ClientRegisterDto, @Req() req: Request) {
    this.throttle(req, 'register', dto.email, 10, 3600);
    return this.clientAuthService.register(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout(@GetUser('sub') userId: string) {
    return this.clientAuthService.logout(userId);
  }

  /** See AuthController.throttle -- same keys, so the buckets are shared. */
  private throttle(
    req: Request,
    action: string,
    email: string | null | undefined,
    perEmailLimit: number,
    windowSeconds: number,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ||
      req.ip ||
      'unknown';
    this.rateLimit.consume(
      `${action}:ip:${ip}`,
      perEmailLimit * 5,
      windowSeconds,
    );

    const normalizedEmail = email?.trim().toLowerCase();
    if (normalizedEmail) {
      this.rateLimit.consume(
        `${action}:email:${normalizedEmail}`,
        perEmailLimit,
        windowSeconds,
      );
    }
  }
}
