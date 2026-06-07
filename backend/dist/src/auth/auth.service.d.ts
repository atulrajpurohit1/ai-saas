import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RolesService } from '../roles/roles.service';
import { SessionsService } from '../sessions/sessions.service';
type AdminPortalRole = string;
export declare class AuthService {
    private prisma;
    private jwtService;
    private configService;
    private rolesService;
    private sessionsService;
    constructor(prisma: PrismaService, jwtService: JwtService, configService: ConfigService, rolesService: RolesService, sessionsService: SessionsService);
    private mapUserRole;
    register(dto: RegisterDto, context?: {
        ipAddress?: string | null;
        userAgent?: string | null;
    }): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    login(dto: LoginDto, context?: {
        ipAddress?: string | null;
        userAgent?: string | null;
    }): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    logout(userId: string, tenantId?: string, sessionId?: string): Promise<boolean>;
    refreshTokens(userId: string, rt: string, role: string, sessionId?: string): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    updateRefreshTokenHash(userId: string, rt: string, role: string): Promise<void>;
    getTokens(userId: string, email: string, tenantId: string, role: AdminPortalRole, branchId?: string | null, isSuperAdmin?: boolean, sessionId?: string): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
}
export {};
