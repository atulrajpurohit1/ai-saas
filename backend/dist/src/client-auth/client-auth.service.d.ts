import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ClientLoginDto } from './dto/client-login.dto';
import { EmailVerificationService } from '../email-verification/email-verification.service';
import { VerifyOtpDto } from '../email-verification/dto/verify-otp.dto';
import { ResendOtpDto } from '../email-verification/dto/resend-otp.dto';
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
    private emailVerification;
    constructor(prisma: PrismaService, jwtService: JwtService, configService: ConfigService, emailVerification: EmailVerificationService);
    login(dto: ClientLoginDto): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    register(dto: ClientRegisterDto): Promise<{
        status: string;
        email: string;
    }>;
    verifyEmail(dto: VerifyOtpDto): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    resendOtp(dto: ResendOtpDto): Promise<{
        message: string;
    }>;
    logout(userId: string): Promise<boolean>;
    refreshTokens(userId: string, rt: string): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    private updateRefreshTokenHash;
    private getTokens;
    private normalizeSlug;
    private companyNameFromSlug;
    private resolveSignupTenant;
    private uniqueConflict;
}
