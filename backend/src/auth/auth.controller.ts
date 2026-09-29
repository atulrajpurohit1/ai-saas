import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { Request } from 'express';
import { ActiveUser } from './interfaces/active-user.interface';
import { VerifyOtpDto } from '../email-verification/dto/verify-otp.dto';
import { ResendOtpDto } from '../email-verification/dto/resend-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private rateLimit: AuthRateLimitService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    this.throttle(req, 'register', dto.email, 10, 3600);
    return this.authService.register(dto, this.requestContext(req));
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    this.throttle(req, 'verify-email', dto.email, 10, 900);
    return this.authService.verifyEmail(dto, this.requestContext(req));
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  resendOtp(@Body() dto: ResendOtpDto, @Req() req: Request) {
    this.throttle(req, 'resend-otp', dto.email, 10, 900);
    return this.authService.resendOtp(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    this.throttle(req, 'login', dto.email, 10, 900);
    return this.authService.login(dto, this.requestContext(req));
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    this.throttle(req, 'forgot-password', dto.email, 10, 3600);
    return this.authService.forgotPassword(dto);
  }

  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  verifyResetOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    this.throttle(req, 'verify-reset-otp', dto.email, 10, 900);
    return this.authService.verifyResetOtp(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    // Keyed on IP only -- the request carries a reset token, not an email.
    this.throttle(req, 'reset-password', null, 10, 900);
    return this.authService.resetPassword(dto);
  }

  /**
   * Counts one attempt against BOTH the caller's IP and the targeted email,
   * so neither a single host spraying many accounts nor a distributed attempt
   * against one account passes unthrottled. The IP allowance is the wider of
   * the two, since a whole office can share one address.
   */
  private throttle(
    req: Request,
    action: string,
    email: string | null | undefined,
    perEmailLimit: number,
    windowSeconds: number,
  ) {
    const ip = this.clientIp(req) || 'unknown';
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

  private clientIp(req: Request) {
    return (
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() || req.ip
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Req() req: Request) {
    const user = req.user as unknown as ActiveUser;
    return this.authService.logout(user.sub, user.tenantId, user.sessionId);
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refreshTokens(@Req() req: Request) {
    const user = req.user as unknown as ActiveUser & { refreshToken: string };
    return this.authService.refreshTokens(
      user.sub,
      user.refreshToken,
      user.role,
      user.sessionId,
    );
  }

  private requestContext(req: Request) {
    return {
      ipAddress: this.clientIp(req),
      userAgent: req.headers['user-agent'] || null,
    };
  }
}
