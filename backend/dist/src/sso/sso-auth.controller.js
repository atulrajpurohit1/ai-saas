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
exports.SsoAuthController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sso_login_dto_1 = require("./dto/sso-login.dto");
const sso_service_1 = require("./sso.service");
let SsoAuthController = class SsoAuthController {
    ssoService;
    configService;
    constructor(ssoService, configService) {
        this.ssoService = ssoService;
        this.configService = configService;
    }
    login(dto, req) {
        return this.ssoService.startLogin(dto, this.requestContext(req));
    }
    async callback(query, req, res) {
        const tokens = await this.ssoService.completeOidcCallback(query, this.requestContext(req));
        if (query.json === '1') {
            return res.json(tokens);
        }
        const frontendUrl = (this.configService.get('FRONTEND_URL') || 'http://localhost:3000').replace(/\/+$/, '');
        const redirectUrl = new URL(`${frontendUrl}/sso/callback`);
        redirectUrl.hash = new URLSearchParams({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
        }).toString();
        return res.redirect(redirectUrl.toString());
    }
    requestContext(req) {
        const forwardedHost = req.headers['x-forwarded-host'];
        const forwardedProto = req.headers['x-forwarded-proto'];
        const host = forwardedHost || req.headers.host;
        const proto = forwardedProto || req.protocol || 'http';
        return {
            ipAddress: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
            userAgent: req.headers['user-agent'] || null,
            origin: host ? `${proto}://${host}` : null,
        };
    }
};
exports.SsoAuthController = SsoAuthController;
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sso_login_dto_1.SSOLoginDto, Object]),
    __metadata("design:returntype", void 0)
], SsoAuthController.prototype, "login", null);
__decorate([
    (0, common_1.Get)('callback'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], SsoAuthController.prototype, "callback", null);
exports.SsoAuthController = SsoAuthController = __decorate([
    (0, common_1.Controller)('auth/sso'),
    __metadata("design:paramtypes", [sso_service_1.SsoService,
        config_1.ConfigService])
], SsoAuthController);
//# sourceMappingURL=sso-auth.controller.js.map