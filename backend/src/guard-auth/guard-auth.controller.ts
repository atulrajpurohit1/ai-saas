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

@Controller('guard-auth')
export class GuardAuthController {
  constructor(private readonly guardAuthService: GuardAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: GuardLoginDto) {
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
