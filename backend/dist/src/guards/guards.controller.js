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
exports.GuardsController = void 0;
const common_1 = require("@nestjs/common");
const guards_service_1 = require("./guards.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const create_guard_dto_1 = require("./dto/create-guard.dto");
const update_guard_dto_1 = require("./dto/update-guard.dto");
let GuardsController = class GuardsController {
    guardsService;
    constructor(guardsService) {
        this.guardsService = guardsService;
    }
    create(user, createGuardDto) {
        return this.guardsService.create(user.sub, user.tenantId, createGuardDto);
    }
    findAll(user) {
        return this.guardsService.findAll(user.tenantId);
    }
    update(user, id, updateGuardDto) {
        return this.guardsService.update(user.sub, user.tenantId, id, updateGuardDto);
    }
};
exports.GuardsController = GuardsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_guard_dto_1.CreateGuardDto]),
    __metadata("design:returntype", void 0)
], GuardsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GuardsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_guard_dto_1.UpdateGuardDto]),
    __metadata("design:returntype", void 0)
], GuardsController.prototype, "update", null);
exports.GuardsController = GuardsController = __decorate([
    (0, common_1.Controller)('guards'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __metadata("design:paramtypes", [guards_service_1.GuardsService])
], GuardsController);
//# sourceMappingURL=guards.controller.js.map