"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var EmailVerificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailVerificationService = exports.PASSWORD_RESET_PURPOSE = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const email_service_1 = require("../email/email.service");
const email_validation_service_1 = require("./email-validation.service");
const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 5;
const SIGNUP_PURPOSE = 'SIGNUP_VERIFICATION';
exports.PASSWORD_RESET_PURPOSE = 'PASSWORD_RESET';
const RESET_TOKEN_TTL_MINUTES = 10;
const INVALID_EMAIL_MESSAGE = 'Please enter a valid email address.';
let EmailVerificationService = EmailVerificationService_1 = class EmailVerificationService {
    prisma;
    emailService;
    emailValidation;
    logger = new common_1.Logger(EmailVerificationService_1.name);
    constructor(prisma, emailService, emailValidation) {
        this.prisma = prisma;
        this.emailService = emailService;
        this.emailValidation = emailValidation;
    }
    async assertValidEmail(rawEmail) {
        const result = await this.emailValidation.validate(rawEmail);
        if (!result.valid) {
            throw new common_1.BadRequestException(INVALID_EMAIL_MESSAGE);
        }
        return result.normalizedEmail;
    }
    async issueOtp(params) {
        const purpose = params.purpose || SIGNUP_PURPOSE;
        const existing = await this.prisma.emailOtp.findUnique({
            where: {
                accountType_accountId_purpose: {
                    accountType: params.accountType,
                    accountId: params.accountId,
                    purpose,
                },
            },
        });
        if (existing) {
            const secondsSinceLastSend = (Date.now() - existing.lastSentAt.getTime()) / 1000;
            if (secondsSinceLastSend < RESEND_COOLDOWN_SECONDS) {
                throw new common_1.HttpException({
                    message: `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLastSend)} seconds before requesting another code.`,
                }, common_1.HttpStatus.TOO_MANY_REQUESTS);
            }
            if (existing.sendCount >= 10) {
                throw new common_1.HttpException({
                    message: 'Too many verification codes requested. Please try again later.',
                }, common_1.HttpStatus.TOO_MANY_REQUESTS);
            }
        }
        const code = this.generateCode();
        const codeHash = this.hashCode(code);
        const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
        await this.prisma.emailOtp.upsert({
            where: {
                accountType_accountId_purpose: {
                    accountType: params.accountType,
                    accountId: params.accountId,
                    purpose,
                },
            },
            create: {
                accountType: params.accountType,
                accountId: params.accountId,
                email: params.email,
                codeHash,
                purpose,
                expiresAt,
                attempts: 0,
                maxAttempts: MAX_VERIFY_ATTEMPTS,
                sendCount: 1,
                lastSentAt: new Date(),
            },
            update: {
                email: params.email,
                codeHash,
                expiresAt,
                attempts: 0,
                consumedAt: null,
                sendCount: { increment: 1 },
                lastSentAt: new Date(),
            },
        });
        this.logger.log(`[DEVELOPMENT MODE] OTP for ${params.email}: ${code}`);
        try {
            if (purpose === exports.PASSWORD_RESET_PURPOSE) {
                await this.emailService.sendPasswordResetOtpEmail(params.tenantId, {
                    email: params.email,
                    name: params.name,
                    code,
                    expiresInMinutes: OTP_TTL_MINUTES,
                });
            }
            else {
                await this.emailService.sendOtpEmail(params.tenantId, {
                    email: params.email,
                    name: params.name,
                    code,
                    expiresInMinutes: OTP_TTL_MINUTES,
                });
            }
        }
        catch (error) {
            this.logger.warn(`Failed to send OTP email to ${params.email}: ${error instanceof Error ? error.message : String(error)}`);
            if (process.env.NODE_ENV === 'production') {
                throw new common_1.BadRequestException(INVALID_EMAIL_MESSAGE);
            }
            else {
                this.logger.warn('Development mode: Ignoring email send failure to unblock workflow.');
            }
        }
        return { expiresAt, cooldownSeconds: RESEND_COOLDOWN_SECONDS };
    }
    async verifyOtp(params) {
        const purpose = params.purpose || SIGNUP_PURPOSE;
        const record = await this.prisma.emailOtp.findUnique({
            where: {
                accountType_accountId_purpose: {
                    accountType: params.accountType,
                    accountId: params.accountId,
                    purpose,
                },
            },
        });
        if (!record || record.consumedAt) {
            throw new common_1.BadRequestException('Invalid verification code. Please request a new code.');
        }
        if (record.expiresAt.getTime() < Date.now()) {
            throw new common_1.BadRequestException('This verification code has expired. Please request a new code.');
        }
        if (record.attempts >= record.maxAttempts) {
            throw new common_1.HttpException({
                message: 'Too many incorrect attempts. Please request a new verification code.',
            }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        const submittedHash = this.hashCode((params.code || '').trim());
        const isMatch = this.timingSafeEqual(submittedHash, record.codeHash);
        if (!isMatch) {
            await this.prisma.emailOtp.update({
                where: { id: record.id },
                data: { attempts: { increment: 1 } },
            });
            throw new common_1.BadRequestException('Invalid verification code.');
        }
        await this.prisma.emailOtp.update({
            where: { id: record.id },
            data: { consumedAt: new Date() },
        });
        return true;
    }
    async issuePasswordResetToken(params) {
        await this.prisma.passwordResetToken.updateMany({
            where: { accountId: params.accountId, consumedAt: null },
            data: { consumedAt: new Date() },
        });
        const token = (0, crypto_1.randomBytes)(32).toString('hex');
        const tokenHash = this.hashCode(token);
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000);
        await this.prisma.passwordResetToken.create({
            data: {
                accountId: params.accountId,
                tenantId: params.tenantId,
                email: params.email,
                tokenHash,
                expiresAt,
            },
        });
        return { token, expiresAt };
    }
    async consumePasswordResetToken(token) {
        const invalidMessage = 'This password reset link is invalid or has expired. Please start the reset process again.';
        if (!token || typeof token !== 'string') {
            throw new common_1.BadRequestException(invalidMessage);
        }
        const tokenHash = this.hashCode(token);
        const record = await this.prisma.passwordResetToken.findUnique({
            where: { tokenHash },
        });
        if (!record || record.consumedAt) {
            throw new common_1.BadRequestException(invalidMessage);
        }
        if (record.expiresAt.getTime() < Date.now()) {
            throw new common_1.BadRequestException(invalidMessage);
        }
        await this.prisma.passwordResetToken.update({
            where: { id: record.id },
            data: { consumedAt: new Date() },
        });
        return {
            accountId: record.accountId,
            tenantId: record.tenantId,
            email: record.email,
        };
    }
    generateCode() {
        const value = (0, crypto_1.randomInt)(0, 10 ** OTP_LENGTH);
        return value.toString().padStart(OTP_LENGTH, '0');
    }
    hashCode(code) {
        return (0, crypto_1.createHash)('sha256').update(code).digest('hex');
    }
    timingSafeEqual(a, b) {
        if (a.length !== b.length)
            return false;
        let mismatch = 0;
        for (let i = 0; i < a.length; i++) {
            mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return mismatch === 0;
    }
};
exports.EmailVerificationService = EmailVerificationService;
exports.EmailVerificationService = EmailVerificationService = EmailVerificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_service_1.EmailService,
        email_validation_service_1.EmailValidationService])
], EmailVerificationService);
//# sourceMappingURL=email-verification.service.js.map