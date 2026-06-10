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
exports.PatrolsController = void 0;
const common_1 = require("@nestjs/common");
const patrols_service_1 = require("./patrols.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const create_checkpoint_dto_1 = require("./dto/create-checkpoint.dto");
const update_checkpoint_dto_1 = require("./dto/update-checkpoint.dto");
const create_patrol_route_dto_1 = require("./dto/create-patrol-route.dto");
const update_patrol_route_dto_1 = require("./dto/update-patrol-route.dto");
const attach_checkpoints_dto_1 = require("./dto/attach-checkpoints.dto");
let PatrolsController = class PatrolsController {
    patrolsService;
    constructor(patrolsService) {
        this.patrolsService = patrolsService;
    }
    createCheckpoint(user, dto) {
        return this.patrolsService.createCheckpoint(user, dto);
    }
    findAllCheckpoints(user, siteId) {
        return this.patrolsService.findAllCheckpoints(user, siteId);
    }
    updateCheckpoint(user, id, dto) {
        return this.patrolsService.updateCheckpoint(user, id, dto);
    }
    createPatrolRoute(user, dto) {
        return this.patrolsService.createPatrolRoute(user, dto);
    }
    findAllPatrolRoutes(user, siteId) {
        return this.patrolsService.findAllPatrolRoutes(user, siteId);
    }
    findPatrolRoute(user, id) {
        return this.patrolsService.findPatrolRoute(user, id);
    }
    updatePatrolRoute(user, id, dto) {
        return this.patrolsService.updatePatrolRoute(user, id, dto);
    }
    attachCheckpoints(user, routeId, dto) {
        return this.patrolsService.attachCheckpoints(user, routeId, dto);
    }
    findAllPatrolRuns(user) {
        return this.patrolsService.findAllPatrolRuns(user);
    }
    findPatrolRun(user, id) {
        return this.patrolsService.findPatrolRun(user, id);
    }
};
exports.PatrolsController = PatrolsController;
__decorate([
    (0, common_1.Post)('checkpoints'),
    (0, permissions_decorator_1.RequirePermission)('patrols.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_checkpoint_dto_1.CreateCheckpointDto]),
    __metadata("design:returntype", void 0)
], PatrolsController.prototype, "createCheckpoint", null);
__decorate([
    (0, common_1.Get)('checkpoints'),
    (0, permissions_decorator_1.RequireAnyPermission)('patrols.view', 'patrols.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('site_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PatrolsController.prototype, "findAllCheckpoints", null);
__decorate([
    (0, common_1.Put)('checkpoints/:id'),
    (0, permissions_decorator_1.RequirePermission)('patrols.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_checkpoint_dto_1.UpdateCheckpointDto]),
    __metadata("design:returntype", void 0)
], PatrolsController.prototype, "updateCheckpoint", null);
__decorate([
    (0, common_1.Post)('patrol-routes'),
    (0, permissions_decorator_1.RequirePermission)('patrols.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_patrol_route_dto_1.CreatePatrolRouteDto]),
    __metadata("design:returntype", void 0)
], PatrolsController.prototype, "createPatrolRoute", null);
__decorate([
    (0, common_1.Get)('patrol-routes'),
    (0, permissions_decorator_1.RequireAnyPermission)('patrols.view', 'patrols.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('site_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PatrolsController.prototype, "findAllPatrolRoutes", null);
__decorate([
    (0, common_1.Get)('patrol-routes/:id'),
    (0, permissions_decorator_1.RequireAnyPermission)('patrols.view', 'patrols.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PatrolsController.prototype, "findPatrolRoute", null);
__decorate([
    (0, common_1.Put)('patrol-routes/:id'),
    (0, permissions_decorator_1.RequirePermission)('patrols.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_patrol_route_dto_1.UpdatePatrolRouteDto]),
    __metadata("design:returntype", void 0)
], PatrolsController.prototype, "updatePatrolRoute", null);
__decorate([
    (0, common_1.Post)('patrol-routes/:id/checkpoints'),
    (0, permissions_decorator_1.RequirePermission)('patrols.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, attach_checkpoints_dto_1.AttachCheckpointsDto]),
    __metadata("design:returntype", void 0)
], PatrolsController.prototype, "attachCheckpoints", null);
__decorate([
    (0, common_1.Get)('patrol-runs'),
    (0, permissions_decorator_1.RequireAnyPermission)('patrols.view', 'patrols.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PatrolsController.prototype, "findAllPatrolRuns", null);
__decorate([
    (0, common_1.Get)('patrol-runs/:id'),
    (0, permissions_decorator_1.RequireAnyPermission)('patrols.view', 'patrols.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PatrolsController.prototype, "findPatrolRun", null);
exports.PatrolsController = PatrolsController = __decorate([
    (0, common_1.Controller)(''),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [patrols_service_1.PatrolsService])
], PatrolsController);
//# sourceMappingURL=patrols.controller.js.map