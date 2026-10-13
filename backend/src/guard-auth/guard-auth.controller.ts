import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtRefreshGuard } from '../auth/guards/jwt-refresh.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { GuardLoginDto } from './dto/guard-login.dto';
import { GuardAuthService } from './guard-auth.service';
import { AuthRateLimitService } from '../auth/auth-rate-limit.service';

@Controller('guard-auth')
export class GuardAuthController {
  constructor(
    private readonly guardAuthService: GuardAuthService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: GuardLoginDto, @Req() req: Request) {
    // Guards sign in with an email OR a phone number, so the per-account key
    // is whichever identifier was submitted.
    const identifier = (dto.identifier || dto.email || dto.phone || '').trim();
    // `req.ip` only -- see AuthController.clientIp. X-Forwarded-For is
    // caller-supplied, so keying a rate limit on it directly meant an
    // attacker could mint a new bucket per request.
    const ip = req.ip || 'unknown';

    this.rateLimit.consume(`login:ip:${ip}`, 50, 900);
    if (identifier) {
      this.rateLimit.consume(
        `login:email:${identifier.toLowerCase()}`,
        10,
        900,
      );
    }

    return this.guardAuthService.login(dto);
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refreshTokens(@Req() req: Request) {
    const user = req.user as unknown as ActiveUser & { refreshToken: string };
    if (user.role !== 'guard') {
      throw new ForbiddenException('Access Denied');
    }
    return this.guardAuthService.refreshTokens(user.sub, user.refreshToken);
  }

  @UseGuards(JwtRefreshGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Req() req: Request) {
    const user = req.user as unknown as ActiveUser & { refreshToken: string };
    if (user.role !== 'guard') {
      throw new ForbiddenException('Access Denied');
    }
    return this.guardAuthService.logout(user.sub);
  }
}
