import { Request } from 'express';
import { ClientAuthService } from './client-auth.service';
import { ClientLoginDto } from './dto/client-login.dto';
import { ClientRegisterDto } from './client-auth.service';
import { VerifyOtpDto } from '../email-verification/dto/verify-otp.dto';
import { ResendOtpDto } from '../email-verification/dto/resend-otp.dto';
export declare class ClientAuthController {
    private readonly clientAuthService;
    constructor(clientAuthService: ClientAuthService);
    login(dto: ClientLoginDto): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    verifyEmail(dto: VerifyOtpDto): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    resendOtp(dto: ResendOtpDto): Promise<{
        message: string;
    }>;
    refreshTokens(req: Request): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    register(dto: ClientRegisterDto): Promise<{
        status: string;
        email: string;
    }>;
    logout(userId: string): Promise<boolean>;
}
