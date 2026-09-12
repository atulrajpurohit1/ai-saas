import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { EmailValidationService } from './email-validation.service';
export declare const PASSWORD_RESET_PURPOSE = "PASSWORD_RESET";
export type VerifiableAccountType = 'USER' | 'CLIENT_USER';
export declare class EmailVerificationService {
    private readonly prisma;
    private readonly emailService;
    private readonly emailValidation;
    private readonly logger;
    constructor(prisma: PrismaService, emailService: EmailService, emailValidation: EmailValidationService);
    assertValidEmail(rawEmail: string): Promise<string>;
    issueOtp(params: {
        accountType: VerifiableAccountType;
        accountId: string;
        tenantId: string | null;
        email: string;
        name?: string | null;
        purpose?: string;
    }): Promise<{
        expiresAt: Date;
        cooldownSeconds: number;
    }>;
    verifyOtp(params: {
        accountType: VerifiableAccountType;
        accountId: string;
        code: string;
        purpose?: string;
    }): Promise<boolean>;
    issuePasswordResetToken(params: {
        accountId: string;
        tenantId: string;
        email: string;
    }): Promise<{
        token: string;
        expiresAt: Date;
    }>;
    consumePasswordResetToken(token: string): Promise<{
        accountId: string;
        tenantId: string;
        email: string;
    }>;
    private generateCode;
    private hashCode;
    private timingSafeEqual;
}
