import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RolesService } from '../roles/roles.service';
type AdminPortalRole = string;
export declare class AuthService {
    private prisma;
    private jwtService;
    private configService;
    private rolesService;
    constructor(prisma: PrismaService, jwtService: JwtService, configService: ConfigService, rolesService: RolesService);
    private mapUserRole;
    register(dto: RegisterDto): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    login(dto: LoginDto): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    logout(userId: string): Promise<boolean>;
    refreshTokens(userId: string, rt: string, role: string): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    updateRefreshTokenHash(userId: string, rt: string, role: string): Promise<void>;
    getTokens(userId: string, email: string, tenantId: string, role: AdminPortalRole, branchId?: string | null, isSuperAdmin?: boolean): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
}
export {};
