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
exports.CommandCenterController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const command_center_service_1 = require("./command-center.service");
let CommandCenterController = class CommandCenterController {
    commandCenterService;
    constructor(commandCenterService) {
        this.commandCenterService = commandCenterService;
    }
    getDashboard(user) {
        return this.commandCenterService.getDashboard(user.tenantId, user.sub, user.role);
    }
    getSummary(user) {
        return this.commandCenterService.getSummary(user.tenantId, user.sub, user.role);
    }
    getRecommendations(user) {
        return this.commandCenterService.getRecommendations(user.tenantId, user.sub, user.role);
    }
    getRisks(user) {
        return this.commandCenterService.getRisks(user.tenantId, user.sub);
    }
};
exports.CommandCenterController = CommandCenterController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CommandCenterController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CommandCenterController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Get)('recommendations'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CommandCenterController.prototype, "getRecommendations", null);
__decorate([
    (0, common_1.Get)('risks'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CommandCenterController.prototype, "getRisks", null);
exports.CommandCenterController = CommandCenterController = __decorate([
    (0, common_1.Controller)('ai-command-center'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin', 'finance'),
    __metadata("design:paramtypes", [command_center_service_1.CommandCenterService])
], CommandCenterController);
//# sourceMappingURL=command-center.controller.js.map