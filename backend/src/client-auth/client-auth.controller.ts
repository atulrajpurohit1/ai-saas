import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { ClientAuthService } from './client-auth.service';
import { AuthRateLimitService } from '../auth/auth-rate-limit.service';
import { ClientLoginDto } from './dto/client-login.dto';
import { ClientChangePasswordDto } from './dto/change-password.dto';
import { ClientSetInitialPasswordDto } from './dto/set-initial-password.dto';
import { ForgotPasswordDto } from '../auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '../auth/dto/reset-password.dto';
import { VerifyOtpDto } from '../email-verification/dto/verify-otp.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtRefreshGuard } from '../auth/guards/jwt-refresh.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

/**
 * Sign-in for the client portal. Deliberately has no sign-up.
 *
 * A client-portal account only means something inside one agency's workspace,
 * and nothing a self-registering stranger can type tells us which agency that
 * is. The account is therefore created by the agency itself, through
 * POST /clients/:id/create-user, which already scopes it to the admin's own
 * tenant and returns a temporary password to hand over.
 */
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

  /**
   * First-login password set, done while signed in with the temporary
   * password. No current password is re-entered here (the login just proved
   * it); the service only honours this while the account is still flagged
   * mustChangePassword.
   */
  @UseGuards(JwtAuthGuard)
  @Post('set-initial-password')
  @HttpCode(HttpStatus.OK)
  setInitialPassword(
    @GetUser() user: ActiveUser,
    @Body() dto: ClientSetInitialPasswordDto,
  ) {
    this.assertClient(user);
    return this.clientAuthService.setInitialPassword(user.sub, dto);
  }

  /** Change password from inside the portal (requires the current password). */
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @GetUser() user: ActiveUser,
    @Body() dto: ClientChangePasswordDto,
  ) {
    this.assertClient(user);
    return this.clientAuthService.changePassword(user.sub, dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    this.throttle(req, 'forgot-password', dto.email, 10, 3600);
    return this.clientAuthService.forgotPassword(dto);
  }

  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  verifyResetOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    this.throttle(req, 'verify-reset-otp', dto.email, 10, 900);
    return this.clientAuthService.verifyResetOtp(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    // Keyed on IP only -- the request carries a reset token, not an email.
    this.throttle(req, 'reset-password', null, 10, 900);
    return this.clientAuthService.resetPassword(dto);
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refreshTokens(@Req() req: Request) {
    const user = req.user as unknown as ActiveUser & { refreshToken: string };
    return this.clientAuthService.refreshTokens(user.sub, user.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout(@GetUser('sub') userId: string) {
    return this.clientAuthService.logout(userId);
  }

  /**
   * A valid JWT alone is not enough for the password endpoints: a staff token
   * also passes JwtAuthGuard. These routes only make sense for a client-portal
   * session, so reject anything else before it reaches the service.
   */
  private assertClient(user: ActiveUser) {
    if (user.role !== 'client' || !user.clientId) {
      throw new ForbiddenException('Access denied');
    }
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
