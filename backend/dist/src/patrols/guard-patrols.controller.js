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
exports.GuardPatrolsController = void 0;
const common_1 = require("@nestjs/common");
const patrols_service_1 = require("./patrols.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const start_patrol_run_dto_1 = require("./dto/start-patrol-run.dto");
const scan_checkpoint_dto_1 = require("./dto/scan-checkpoint.dto");
let GuardPatrolsController = class GuardPatrolsController {
    patrolsService;
    constructor(patrolsService) {
        this.patrolsService = patrolsService;
    }
    getGuardContext(user) {
        if (user.role !== 'guard' || !user.guardId || !user.tenantId) {
            throw new common_1.ForbiddenException('Guard access required');
        }
        return {
            tenantId: user.tenantId,
            guardId: user.guardId,
        };
    }
    getShiftPatrolRoutes(user, shiftId) {
        const { tenantId, guardId } = this.getGuardContext(user);
        return this.patrolsService.getShiftPatrolRoutes(tenantId, guardId, shiftId);
    }
    startPatrolRun(user, shiftId, dto) {
        const { tenantId, guardId } = this.getGuardContext(user);
        return this.patrolsService.startPatrolRun(tenantId, guardId, shiftId, dto);
    }
    scanCheckpoint(user, runId, checkpointId, dto) {
        const { tenantId, guardId } = this.getGuardContext(user);
        return this.patrolsService.scanCheckpoint(tenantId, guardId, runId, checkpointId, dto);
    }
    completePatrolRun(user, runId) {
        const { tenantId, guardId } = this.getGuardContext(user);
        return this.patrolsService.completePatrolRun(tenantId, guardId, runId);
    }
    getGuardPatrolRuns(user) {
        const { tenantId, guardId } = this.getGuardContext(user);
        return this.patrolsService.getGuardPatrolRuns(tenantId, guardId);
    }
};
exports.GuardPatrolsController = GuardPatrolsController;
__decorate([
    (0, common_1.Get)('shifts/:id/patrol-routes'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GuardPatrolsController.prototype, "getShiftPatrolRoutes", null);
__decorate([
    (0, common_1.Post)('shifts/:id/patrol-runs/start'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, start_patrol_run_dto_1.StartPatrolRunDto]),
    __metadata("design:returntype", void 0)
], GuardPatrolsController.prototype, "startPatrolRun", null);
__decorate([
    (0, common_1.Post)('patrol-runs/:id/checkpoints/:checkpointId/scan'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('checkpointId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, scan_checkpoint_dto_1.ScanCheckpointDto]),
    __metadata("design:returntype", void 0)
], GuardPatrolsController.prototype, "scanCheckpoint", null);
__decorate([
    (0, common_1.Post)('patrol-runs/:id/complete'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GuardPatrolsController.prototype, "completePatrolRun", null);
__decorate([
    (0, common_1.Get)('patrol-runs'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GuardPatrolsController.prototype, "getGuardPatrolRuns", null);
exports.GuardPatrolsController = GuardPatrolsController = __decorate([
    (0, common_1.Controller)('guard'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('guard'),
    __metadata("design:paramtypes", [patrols_service_1.PatrolsService])
], GuardPatrolsController);
//# sourceMappingURL=guard-patrols.controller.js.map