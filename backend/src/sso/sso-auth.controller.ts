import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { SSOLoginDto } from './dto/sso-login.dto';
import { SsoService } from './sso.service';

@Controller('auth/sso')
export class SsoAuthController {
  constructor(
    private readonly ssoService: SsoService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: SSOLoginDto, @Req() req: Request) {
    return this.ssoService.startLogin(dto, this.requestContext(req));
  }

  @Get('callback')
  async callback(
    @Query() query: { code?: string; state?: string; json?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tokens = await this.ssoService.completeOidcCallback(query, this.requestContext(req));
    if (query.json === '1') {
      return res.json(tokens);
    }

    const frontendUrl = (this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000').replace(/\/+$/, '');
    const redirectUrl = new URL(`${frontendUrl}/sso/callback`);
    redirectUrl.hash = new URLSearchParams({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    }).toString();
    return res.redirect(redirectUrl.toString());
  }

  private requestContext(req: Request) {
    const forwardedHost = req.headers['x-forwarded-host'] as string | undefined;
    const forwardedProto = req.headers['x-forwarded-proto'] as string | undefined;
    const host = forwardedHost || req.headers.host;
    const proto = forwardedProto || req.protocol || 'http';

    return {
      ipAddress: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent'] || null,
      origin: host ? `${proto}://${host}` : null,
    };
  }
}
