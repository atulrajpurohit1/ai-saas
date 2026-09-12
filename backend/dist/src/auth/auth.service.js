"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const bcrypt = __importStar(require("bcrypt"));
const roles_service_1 = require("../roles/roles.service");
const sessions_service_1 = require("../sessions/sessions.service");
const email_verification_service_1 = require("../email-verification/email-verification.service");
let AuthService = class AuthService {
    prisma;
    jwtService;
    configService;
    rolesService;
    sessionsService;
    emailVerification;
    constructor(prisma, jwtService, configService, rolesService, sessionsService, emailVerification) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.configService = configService;
        this.rolesService = rolesService;
        this.sessionsService = sessionsService;
        this.emailVerification = emailVerification;
    }
    mapUserRole(role) {
        return role.toLowerCase() === 'finance' ? 'finance' : 'admin';
    }
    async register(dto, context) {
        const email = await this.emailVerification.assertValidEmail(dto.email);
        const hashedPassword = await bcrypt.hash(dto.password, 10);
        const name = dto.name?.trim() || '';
        const tenantName = dto.tenantName?.trim() || '';
        try {
            const existingUser = await this.prisma.user.findUnique({
                where: { email },
            });
            if (existingUser) {
                if (existingUser.emailVerified) {
                    throw new common_1.ConflictException('An account with this email already exists.');
                }
                await this.prisma.user.update({
                    where: { id: existingUser.id },
                    data: { password: hashedPassword, name },
                });
                await this.emailVerification.issueOtp({
                    accountType: 'USER',
                    accountId: existingUser.id,
                    tenantId: existingUser.tenantId,
                    email,
                    name,
                });
                return { status: 'verification_required', email };
            }
            const result = await this.prisma.$transaction(async (tx) => {
                const tenantSlug = await this.generateUniqueTenantSlug(tx, tenantName);
                const tenant = await tx.tenant.create({
                    data: {
                        name: tenantName,
                        slug: tenantSlug,
                    },
                });
                const user = await tx.user.create({
                    data: {
                        email,
                        password: hashedPassword,
                        name,
                        tenantId: tenant.id,
                        emailVerified: false,
                    },
                });
                return { tenant, user };
            });
            await this.rolesService.ensureTenantSystemRoles(result.tenant.id);
            await this.rolesService.ensureDefaultAssignmentForUser(result.user.id);
            await this.emailVerification.issueOtp({
                accountType: 'USER',
                accountId: result.user.id,
                tenantId: result.tenant.id,
                email,
                name,
            });
            return { status: 'verification_required', email };
        }
        catch (error) {
            if (typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                error.code === 'P2002') {
                const meta = error.meta;
                const target = meta?.target?.join(',') || '';
                if (target.includes('email')) {
                    throw new common_1.ConflictException('An account with this email already exists.');
                }
                throw new common_1.ConflictException('Something went wrong creating your account. Please try again.');
            }
            throw error;
        }
    }
    async generateUniqueTenantSlug(tx, tenantName) {
        const base = tenantName
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'company';
        let candidate = base;
        let suffix = 1;
        while (await tx.tenant.findUnique({ where: { slug: candidate } })) {
            suffix += 1;
            candidate = `${base}-${suffix}`;
        }
        return candidate;
    }
    async verifyEmail(dto, context) {
        const email = dto.email.trim().toLowerCase();
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid verification code.');
        }
        if (!user.emailVerified) {
            await this.emailVerification.verifyOtp({
                accountType: 'USER',
                accountId: user.id,
                code: dto.code,
            });
            await this.prisma.user.update({
                where: { id: user.id },
                data: { emailVerified: true, emailVerifiedAt: new Date() },
            });
        }
        await this.rolesService.ensureDefaultAssignmentForUser(user.id);
        const profile = await this.rolesService.getUserAccessProfile(user.id);
        const sessionId = this.sessionsService.generateSessionId();
        const tokens = await this.getTokens(user.id, user.email, user.tenantId, profile.role, profile.branchId, profile.isSuperAdmin, sessionId);
        await this.updateRefreshTokenHash(user.id, tokens.refresh_token, profile.role);
        await this.sessionsService.createSession({
            id: sessionId,
            tenantId: user.tenantId,
            userId: user.id,
            refreshToken: tokens.refresh_token,
            source: 'password',
            ipAddress: context?.ipAddress,
            userAgent: context?.userAgent,
        });
        return tokens;
    }
    async resendOtp(dto) {
        const email = dto.email.trim().toLowerCase();
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (user && !user.emailVerified) {
            await this.emailVerification.issueOtp({
                accountType: 'USER',
                accountId: user.id,
                tenantId: user.tenantId,
                email: user.email,
                name: user.name,
            });
        }
        return {
            message: 'If an unverified account exists for this email, a new verification code has been sent.',
        };
    }
    forgotPasswordGenericMessage = 'If an account exists for this email, a verification code has been sent.';
    async forgotPassword(dto) {
        const email = dto.email.trim().toLowerCase();
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (user && user.emailVerified) {
            await this.emailVerification.issueOtp({
                accountType: 'USER',
                accountId: user.id,
                tenantId: user.tenantId,
                email: user.email,
                name: user.name,
                purpose: email_verification_service_1.PASSWORD_RESET_PURPOSE,
            });
        }
        return { message: this.forgotPasswordGenericMessage };
    }
    async verifyResetOtp(dto) {
        const email = dto.email.trim().toLowerCase();
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user || !user.emailVerified) {
            throw new common_1.BadRequestException('Invalid verification code.');
        }
        await this.emailVerification.verifyOtp({
            accountType: 'USER',
            accountId: user.id,
            code: dto.code,
            purpose: email_verification_service_1.PASSWORD_RESET_PURPOSE,
        });
        const { token, expiresAt } = await this.emailVerification.issuePasswordResetToken({
            accountId: user.id,
            tenantId: user.tenantId,
            email: user.email,
        });
        return { resetToken: token, expiresAt };
    }
    async resetPassword(dto) {
        if (dto.newPassword !== dto.confirmPassword) {
            throw new common_1.BadRequestException('Passwords do not match.');
        }
        const { accountId, tenantId } = await this.emailVerification.consumePasswordResetToken(dto.resetToken);
        const user = await this.prisma.user.findUnique({
            where: { id: accountId },
        });
        if (!user || user.tenantId !== tenantId) {
            throw new common_1.BadRequestException('This password reset link is invalid or has expired. Please start the reset process again.');
        }
        const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
        await this.prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword, refreshToken: null },
        });
        await this.prisma.userSession.updateMany({
            where: { userId: user.id, status: 'active' },
            data: { status: 'revoked', refreshTokenHash: null, revokedAt: new Date() },
        });
        return { message: 'Password reset successfully.' };
    }
    async login(dto, context) {
        const email = dto.email.trim().toLowerCase();
        const user = await this.prisma.user.findUnique({
            where: { email },
            include: { tenant: true },
        });
        if (!user)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const passwordMatches = await bcrypt.compare(dto.password, user.password);
        if (!passwordMatches)
            throw new common_1.UnauthorizedException('Invalid credentials');
        if (!user.emailVerified) {
            throw new common_1.ForbiddenException('Please verify your email before logging in.');
        }
        await this.rolesService.ensureDefaultAssignmentForUser(user.id);
        const profile = await this.rolesService.getUserAccessProfile(user.id);
        const sessionId = this.sessionsService.generateSessionId();
        const tokens = await this.getTokens(user.id, user.email, user.tenantId, profile.role, profile.branchId, profile.isSuperAdmin, sessionId);
        await this.updateRefreshTokenHash(user.id, tokens.refresh_token, profile.role);
        await this.sessionsService.createSession({
            id: sessionId,
            tenantId: user.tenantId,
            userId: user.id,
            refreshToken: tokens.refresh_token,
            source: 'password',
            ipAddress: context?.ipAddress,
            userAgent: context?.userAgent,
        });
        return tokens;
    }
    async logout(userId, tenantId, sessionId) {
        if (tenantId && sessionId) {
            await this.sessionsService.revokeById(tenantId, sessionId, 'USER_LOGOUT');
        }
        await this.prisma.user.updateMany({
            where: { id: userId, refreshToken: { not: null } },
            data: { refreshToken: null },
        });
        return true;
    }
    async refreshTokens(userId, rt, role, sessionId) {
        if (sessionId) {
            await this.sessionsService.validateRefreshSession(sessionId, rt);
        }
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.refreshToken)
            throw new common_1.ForbiddenException('Access Denied');
        const rtMatches = await bcrypt.compare(rt, user.refreshToken);
        if (!rtMatches)
            throw new common_1.ForbiddenException('Access Denied');
        const typedUser = user;
        await this.rolesService.ensureDefaultAssignmentForUser(user.id);
        const profile = await this.rolesService.getUserAccessProfile(user.id);
        const tokens = await this.getTokens(typedUser.id, typedUser.email, typedUser.tenantId, profile.role, profile.branchId, profile.isSuperAdmin, sessionId);
        await this.updateRefreshTokenHash(typedUser.id, tokens.refresh_token, profile.role);
        if (sessionId) {
            await this.sessionsService.rotateRefreshToken(sessionId, tokens.refresh_token);
        }
        return tokens;
    }
    async updateRefreshTokenHash(userId, rt, role) {
        const hash = await bcrypt.hash(rt, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: { refreshToken: hash },
        });
    }
    async getTokens(userId, email, tenantId, role, branchId = null, isSuperAdmin = true, sessionId) {
        const atSecret = this.configService.get('JWT_ACCESS_SECRET');
        const atExpires = this.configService.get('JWT_ACCESS_EXPIRES_IN');
        const rtSecret = this.configService.get('JWT_REFRESH_SECRET');
        const rtExpires = this.configService.get('JWT_REFRESH_EXPIRES_IN');
        const [at, rt] = await Promise.all([
            this.jwtService.signAsync({
                sub: userId,
                email,
                tenantId,
                role,
                branchId,
                isSuperAdmin,
                sessionId,
            }, {
                secret: atSecret,
                expiresIn: atExpires,
            }),
            this.jwtService.signAsync({
                sub: userId,
                email,
                tenantId,
                role,
                branchId,
                isSuperAdmin,
                sessionId,
            }, {
                secret: rtSecret,
                expiresIn: rtExpires,
            }),
        ]);
        return {
            access_token: at,
            refresh_token: rt,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        roles_service_1.RolesService,
        sessions_service_1.SessionsService,
        email_verification_service_1.EmailVerificationService])
], AuthService);
//# sourceMappingURL=auth.service.js.map