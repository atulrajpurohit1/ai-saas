import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
type AdminPortalRole = 'admin' | 'finance';
export declare class AuthService {
    private prisma;
    private jwtService;
    private configService;
    constructor(prisma: PrismaService, jwtService: JwtService, configService: ConfigService);
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
