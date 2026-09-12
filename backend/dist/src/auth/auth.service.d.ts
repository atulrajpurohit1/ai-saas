import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RolesService } from '../roles/roles.service';
import { SessionsService } from '../sessions/sessions.service';
import { EmailVerificationService } from '../email-verification/email-verification.service';
import { VerifyOtpDto } from '../email-verification/dto/verify-otp.dto';
import { ResendOtpDto } from '../email-verification/dto/resend-otp.dto';
type AdminPortalRole = string;
export declare class AuthService {
    private prisma;
    private jwtService;
    private configService;
    private rolesService;
    private sessionsService;
    private emailVerification;
    constructor(prisma: PrismaService, jwtService: JwtService, configService: ConfigService, rolesService: RolesService, sessionsService: SessionsService, emailVerification: EmailVerificationService);
    private mapUserRole;
    register(dto: RegisterDto, context?: {
        ipAddress?: string | null;
        userAgent?: string | null;
    }): Promise<{
        status: string;
        email: string;
    }>;
    private generateUniqueTenantSlug;
    verifyEmail(dto: VerifyOtpDto, context?: {
        ipAddress?: string | null;
        userAgent?: string | null;
    }): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    resendOtp(dto: ResendOtpDto): Promise<{
        message: string;
    }>;
    private readonly forgotPasswordGenericMessage;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    verifyResetOtp(dto: VerifyOtpDto): Promise<{
        resetToken: string;
        expiresAt: Date;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
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
