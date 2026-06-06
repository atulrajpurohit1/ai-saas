import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { ActiveUser } from '../interfaces/active-user.interface';
declare const JwtRefreshStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtRefreshStrategy extends JwtRefreshStrategy_base {
    constructor(configService: ConfigService);
    validate(req: Request, payload: ActiveUser): {
        refreshToken: string;
        sub: string;
        email?: string;
        phone?: string;
        tenantId: string;
        role: string;
        branchId?: string | null;
        isSuperAdmin?: boolean;
        clientId?: string;
        guardId?: string;
    };
}
export {};
