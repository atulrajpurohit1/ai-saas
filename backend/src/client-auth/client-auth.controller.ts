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
