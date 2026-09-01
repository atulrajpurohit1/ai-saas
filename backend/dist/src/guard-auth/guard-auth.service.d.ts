import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { GuardLoginDto } from './dto/guard-login.dto';
export declare class GuardAuthService {
    private prisma;
    private jwtService;
    private configService;
    private auditService;
    constructor(prisma: PrismaService, jwtService: JwtService, configService: ConfigService, auditService: AuditService);
    login(dto: GuardLoginDto): Promise<{
        guard: {
            id: string;
            name: string;
            phone: string | null;
            email: string | null;
            tenantId: string;
            tenantName: string;
        };
        access_token: string;
        refresh_token: string;
    }>;
    refreshTokens(guardId: string, rt: string): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    logout(guardId: string): Promise<boolean>;
    private updateRefreshTokenHash;
    private getTokens;
}
