import { Request } from 'express';
import { ClientAuthService } from './client-auth.service';
import { AuthRateLimitService } from '../auth/auth-rate-limit.service';
import { ClientLoginDto } from './dto/client-login.dto';
import { ClientRegisterDto } from './client-auth.service';
import { VerifyOtpDto } from '../email-verification/dto/verify-otp.dto';
import { ResendOtpDto } from '../email-verification/dto/resend-otp.dto';
export declare class ClientAuthController {
    private readonly clientAuthService;
    private readonly rateLimit;
    constructor(clientAuthService: ClientAuthService, rateLimit: AuthRateLimitService);
    login(dto: ClientLoginDto, req: Request): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    verifyEmail(dto: VerifyOtpDto, req: Request): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    resendOtp(dto: ResendOtpDto, req: Request): Promise<{
        message: string;
    }>;
    refreshTokens(req: Request): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    register(dto: ClientRegisterDto, req: Request): Promise<{
        status: string;
        email: string;
    }>;
    logout(userId: string): Promise<boolean>;
    private throttle;
}
