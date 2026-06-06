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
exports.ApiKeysController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const api_keys_service_1 = require("./api-keys.service");
const create_api_key_dto_1 = require("./dto/create-api-key.dto");
const update_api_key_dto_1 = require("./dto/update-api-key.dto");
let ApiKeysController = class ApiKeysController {
    apiKeysService;
    constructor(apiKeysService) {
        this.apiKeysService = apiKeysService;
    }
    listPermissionDefinitions() {
        return this.apiKeysService.listPermissionDefinitions();
    }
    list(user) {
        return this.apiKeysService.list(user);
    }
    create(user, dto) {
        return this.apiKeysService.create(user, dto);
    }
    update(user, id, dto) {
        return this.apiKeysService.update(user, id, dto);
    }
    revoke(user, id) {
        return this.apiKeysService.revoke(user, id);
    }
    regenerate(user, id) {
        return this.apiKeysService.regenerate(user, id);
    }
};
exports.ApiKeysController = ApiKeysController;
__decorate([
    (0, common_1.Get)('permissions'),
    (0, permissions_decorator_1.RequireAnyPermission)('api_keys.view', 'api_keys.manage'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ApiKeysController.prototype, "listPermissionDefinitions", null);
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.RequirePermission)('api_keys.view'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ApiKeysController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.RequirePermission)('api_keys.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_api_key_dto_1.CreateApiKeyDto]),
    __metadata("design:returntype", void 0)
], ApiKeysController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, permissions_decorator_1.RequirePermission)('api_keys.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_api_key_dto_1.UpdateApiKeyDto]),
    __metadata("design:returntype", void 0)
], ApiKeysController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/revoke'),
    (0, permissions_decorator_1.RequirePermission)('api_keys.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ApiKeysController.prototype, "revoke", null);
__decorate([
    (0, common_1.Post)(':id/regenerate'),
    (0, permissions_decorator_1.RequirePermission)('api_keys.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ApiKeysController.prototype, "regenerate", null);
exports.ApiKeysController = ApiKeysController = __decorate([
    (0, common_1.Controller)('api-keys'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [api_keys_service_1.ApiKeysService])
], ApiKeysController);
//# sourceMappingURL=api-keys.controller.js.map