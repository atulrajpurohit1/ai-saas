import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  email?: string;
  phone?: string;
  tenantId?: string;
  tenant_id?: string;
  role: 'admin' | 'finance' | 'supervisor' | 'client' | 'guard';
  clientId?: string;
  client_id?: string;
  guardId?: string;
  guard_id?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET')!,
    });
  }

  validate(payload: JwtPayload) {
    const tenantId = payload.tenantId ?? payload.tenant_id;
    const clientId = payload.clientId ?? payload.client_id;
    const guardId = payload.guardId ?? payload.guard_id;

    return {
      sub: payload.sub,
      email: payload.email,
      phone: payload.phone,
      tenantId,
      role: payload.role,
      clientId,
      guardId,
    };
  }
}
