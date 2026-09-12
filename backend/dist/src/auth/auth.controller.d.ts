import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Request } from 'express';
import { VerifyOtpDto } from '../email-verification/dto/verify-otp.dto';
import { ResendOtpDto } from '../email-verification/dto/resend-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    register(dto: RegisterDto, req: Request): Promise<{
        status: string;
        email: string;
    }>;
    verifyEmail(dto: VerifyOtpDto, req: Request): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    resendOtp(dto: ResendOtpDto): Promise<{
        message: string;
    }>;
    login(dto: LoginDto, req: Request): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
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
    logout(req: Request): Promise<boolean>;
    refreshTokens(req: Request): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    private requestContext;
}
