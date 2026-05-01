import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ClientLoginDto } from './dto/client-login.dto';
export declare class ClientRegisterDto {
    email: string;
    password: string;
    name: string;
    tenantSlug: string;
}
export declare class ClientAuthService {
    private prisma;
    private jwtService;
    private configService;
    constructor(prisma: PrismaService, jwtService: JwtService, configService: ConfigService);
    login(dto: ClientLoginDto): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    register(dto: ClientRegisterDto): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    logout(userId: string): Promise<boolean>;
    refreshTokens(userId: string, rt: string): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    private updateRefreshTokenHash;
    private getTokens;
}
