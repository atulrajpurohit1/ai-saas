import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import { GetPlatformAdmin } from './decorators/get-platform-admin.decorator';
import { ActivePlatformAdmin } from './interfaces/active-platform-admin.interface';
import { GetPlatformRefresh } from './decorators/get-platform-refresh.decorator';
import { PlatformRefreshPayload } from './strategies/jwt-platform-refresh.strategy';

/**
 * Sign-in for the platform console, on its own route prefix and its own
 * credential store.
 *
 * Mounted at `platform-auth` rather than under `auth` on purpose: the tenant
 * login at `auth/login` must not be able to issue a platform token, and
 * keeping them in separate controllers with separate services means no shared
 * code path can start doing so by accident. There is no registration endpoint
 * here -- accounts come from the seed script or from an existing admin.
 */
@Controller('platform-auth')
export class PlatformAuthController {
  constructor(private readonly auth: PlatformAuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: PlatformLoginDto, @Ip() ip: string) {
    return this.auth.login(dto.email, dto.password, ip);
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt-platform-refresh'))
  refresh(@GetPlatformRefresh() payload: PlatformRefreshPayload) {
    return this.auth.refresh(payload.adminId, payload.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(PlatformAdminGuard)
  logout(@GetPlatformAdmin() admin: ActivePlatformAdmin) {
    return this.auth.logout(admin.adminId);
  }

  /**
   * Who am I. The console calls this on load to decide whether to show the
   * login form or the console, so that the decision rests on a server answer
   * rather than on anything in localStorage.
   */
  @Get('me')
  @UseGuards(PlatformAdminGuard)
  me(@GetPlatformAdmin() admin: ActivePlatformAdmin) {
    return this.auth.me(admin);
  }
}
