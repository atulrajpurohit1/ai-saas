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
exports.GuardAuthController = void 0;
const common_1 = require("@nestjs/common");
const guard_login_dto_1 = require("./dto/guard-login.dto");
const guard_auth_service_1 = require("./guard-auth.service");
let GuardAuthController = class GuardAuthController {
    guardAuthService;
    constructor(guardAuthService) {
        this.guardAuthService = guardAuthService;
    }
    login(dto) {
        return this.guardAuthService.login(dto);
    }
};
exports.GuardAuthController = GuardAuthController;
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [guard_login_dto_1.GuardLoginDto]),
    __metadata("design:returntype", void 0)
], GuardAuthController.prototype, "login", null);
exports.GuardAuthController = GuardAuthController = __decorate([
    (0, common_1.Controller)('guard-auth'),
    __metadata("design:paramtypes", [guard_auth_service_1.GuardAuthService])
], GuardAuthController);
//# sourceMappingURL=guard-auth.controller.js.map