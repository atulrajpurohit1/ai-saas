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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const auth_rate_limit_service_1 = require("./auth-rate-limit.service");
const register_dto_1 = require("./dto/register.dto");
const login_dto_1 = require("./dto/login.dto");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
const jwt_refresh_guard_1 = require("./guards/jwt-refresh.guard");
const verify_otp_dto_1 = require("../email-verification/dto/verify-otp.dto");
const resend_otp_dto_1 = require("../email-verification/dto/resend-otp.dto");
const forgot_password_dto_1 = require("./dto/forgot-password.dto");
const reset_password_dto_1 = require("./dto/reset-password.dto");
let AuthController = class AuthController {
    authService;
    rateLimit;
    constructor(authService, rateLimit) {
        this.authService = authService;
        this.rateLimit = rateLimit;
    }
    register(dto, req) {
        this.throttle(req, 'register', dto.email, 10, 3600);
        return this.authService.register(dto, this.requestContext(req));
    }
    verifyEmail(dto, req) {
        this.throttle(req, 'verify-email', dto.email, 10, 900);
        return this.authService.verifyEmail(dto, this.requestContext(req));
    }
    resendOtp(dto, req) {
        this.throttle(req, 'resend-otp', dto.email, 10, 900);
        return this.authService.resendOtp(dto);
    }
    login(dto, req) {
        this.throttle(req, 'login', dto.email, 10, 900);
        return this.authService.login(dto, this.requestContext(req));
    }
    forgotPassword(dto, req) {
        this.throttle(req, 'forgot-password', dto.email, 10, 3600);
        return this.authService.forgotPassword(dto);
    }
    verifyResetOtp(dto, req) {
        this.throttle(req, 'verify-reset-otp', dto.email, 10, 900);
        return this.authService.verifyResetOtp(dto);
    }
    resetPassword(dto, req) {
        this.throttle(req, 'reset-password', null, 10, 900);
        return this.authService.resetPassword(dto);
    }
    throttle(req, action, email, perEmailLimit, windowSeconds) {
        const ip = this.clientIp(req) || 'unknown';
        this.rateLimit.consume(`${action}:ip:${ip}`, perEmailLimit * 5, windowSeconds);
        const normalizedEmail = email?.trim().toLowerCase();
        if (normalizedEmail) {
            this.rateLimit.consume(`${action}:email:${normalizedEmail}`, perEmailLimit, windowSeconds);
        }
    }
    clientIp(req) {
        return (req.headers['x-forwarded-for']
            ?.split(',')[0]
            ?.trim() || req.ip);
    }
    logout(req) {
        const user = req.user;
        return this.authService.logout(user.sub, user.tenantId, user.sessionId);
    }
    refreshTokens(req) {
        const user = req.user;
        return this.authService.refreshTokens(user.sub, user.refreshToken, user.role, user.sessionId);
    }
    requestContext(req) {
        return {
            ipAddress: this.clientIp(req),
            userAgent: req.headers['user-agent'] || null,
        };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('register'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.RegisterDto, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('verify-email'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_otp_dto_1.VerifyOtpDto, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "verifyEmail", null);
__decorate([
    (0, common_1.Post)('resend-otp'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [resend_otp_dto_1.ResendOtpDto, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "resendOtp", null);
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('forgot-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [forgot_password_dto_1.ForgotPasswordDto, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, common_1.Post)('verify-reset-otp'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_otp_dto_1.VerifyOtpDto, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "verifyResetOtp", null);
__decorate([
    (0, common_1.Post)('reset-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [reset_password_dto_1.ResetPasswordDto, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.UseGuards)(jwt_refresh_guard_1.JwtRefreshGuard),
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "refreshTokens", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        auth_rate_limit_service_1.AuthRateLimitService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map