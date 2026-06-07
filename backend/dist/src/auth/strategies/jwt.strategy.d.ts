import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
interface JwtPayload {
    sub: string;
    email?: string;
    phone?: string;
    tenantId?: string;
    tenant_id?: string;
    role: string;
    branchId?: string | null;
    branch_id?: string | null;
    isSuperAdmin?: boolean;
    is_super_admin?: boolean;
    clientId?: string;
    client_id?: string;
    guardId?: string;
    guard_id?: string;
    sessionId?: string;
    session_id?: string;
}
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    constructor(configService: ConfigService);
    validate(payload: JwtPayload): {
        sub: string;
        email: string | undefined;
        phone: string | undefined;
        tenantId: string | undefined;
        role: string;
        branchId: string | null;
        isSuperAdmin: boolean;
        clientId: string | undefined;
        guardId: string | undefined;
        sessionId: string | undefined;
    };
}
export {};
