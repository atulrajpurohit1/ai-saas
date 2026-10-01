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
exports.ClientAuthController = void 0;
const common_1 = require("@nestjs/common");
const client_auth_service_1 = require("./client-auth.service");
const auth_rate_limit_service_1 = require("../auth/auth-rate-limit.service");
const client_login_dto_1 = require("./dto/client-login.dto");
const client_auth_service_2 = require("./client-auth.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const jwt_refresh_guard_1 = require("../auth/guards/jwt-refresh.guard");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const verify_otp_dto_1 = require("../email-verification/dto/verify-otp.dto");
const resend_otp_dto_1 = require("../email-verification/dto/resend-otp.dto");
let ClientAuthController = class ClientAuthController {
    clientAuthService;
    rateLimit;
    constructor(clientAuthService, rateLimit) {
        this.clientAuthService = clientAuthService;
        this.rateLimit = rateLimit;
    }
    login(dto, req) {
        this.throttle(req, 'login', dto.email, 10, 900);
        return this.clientAuthService.login(dto);
    }
    verifyEmail(dto, req) {
        this.throttle(req, 'verify-email', dto.email, 10, 900);
        return this.clientAuthService.verifyEmail(dto);
    }
    resendOtp(dto, req) {
        this.throttle(req, 'resend-otp', dto.email, 10, 900);
        return this.clientAuthService.resendOtp(dto);
    }
    refreshTokens(req) {
        const user = req.user;
        return this.clientAuthService.refreshTokens(user.sub, user.refreshToken);
    }
    register(dto, req) {
        this.throttle(req, 'register', dto.email, 10, 3600);
        return this.clientAuthService.register(dto);
    }
    logout(userId) {
        return this.clientAuthService.logout(userId);
    }
    throttle(req, action, email, perEmailLimit, windowSeconds) {
        const ip = req.headers['x-forwarded-for']
            ?.split(',')[0]
            ?.trim() ||
            req.ip ||
            'unknown';
        this.rateLimit.consume(`${action}:ip:${ip}`, perEmailLimit * 5, windowSeconds);
        const normalizedEmail = email?.trim().toLowerCase();
        if (normalizedEmail) {
            this.rateLimit.consume(`${action}:email:${normalizedEmail}`, perEmailLimit, windowSeconds);
        }
    }
};
exports.ClientAuthController = ClientAuthController;
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [client_login_dto_1.ClientLoginDto, Object]),
    __metadata("design:returntype", void 0)
], ClientAuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('verify-email'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_otp_dto_1.VerifyOtpDto, Object]),
    __metadata("design:returntype", void 0)
], ClientAuthController.prototype, "verifyEmail", null);
__decorate([
    (0, common_1.Post)('resend-otp'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [resend_otp_dto_1.ResendOtpDto, Object]),
    __metadata("design:returntype", void 0)
], ClientAuthController.prototype, "resendOtp", null);
__decorate([
    (0, common_1.UseGuards)(jwt_refresh_guard_1.JwtRefreshGuard),
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClientAuthController.prototype, "refreshTokens", null);
__decorate([
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [client_auth_service_2.ClientRegisterDto, Object]),
    __metadata("design:returntype", void 0)
], ClientAuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, get_user_decorator_1.GetUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ClientAuthController.prototype, "logout", null);
exports.ClientAuthController = ClientAuthController = __decorate([
    (0, common_1.Controller)('client-auth'),
    __metadata("design:paramtypes", [client_auth_service_1.ClientAuthService,
        auth_rate_limit_service_1.AuthRateLimitService])
], ClientAuthController);
//# sourceMappingURL=client-auth.controller.js.map