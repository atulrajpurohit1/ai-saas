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
exports.ShiftsController = void 0;
const common_1 = require("@nestjs/common");
const shifts_service_1 = require("./shifts.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const create_shift_dto_1 = require("./dto/create-shift.dto");
const assign_guard_dto_1 = require("./dto/assign-guard.dto");
const common_2 = require("@nestjs/common");
let ShiftsController = class ShiftsController {
    shiftsService;
    constructor(shiftsService) {
        this.shiftsService = shiftsService;
    }
    create(user, createShiftDto) {
        return this.shiftsService.create(user, createShiftDto);
    }
    findAll(user, branchId) {
        return this.shiftsService.findAll(user, branchId);
    }
    recommendGuards(user, id) {
        return this.shiftsService.recommendGuards(user, id);
    }
    assign(user, id, dto) {
        return this.shiftsService.assign(user, id, dto.guardId);
    }
    unassign(user, id) {
        return this.shiftsService.unassign(user, id);
    }
};
exports.ShiftsController = ShiftsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_shift_dto_1.CreateShiftDto]),
    __metadata("design:returntype", void 0)
], ShiftsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('branch_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ShiftsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id/recommend-guards'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_2.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ShiftsController.prototype, "recommendGuards", null);
__decorate([
    (0, common_2.Put)(':id/assign'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_2.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, assign_guard_dto_1.AssignGuardDto]),
    __metadata("design:returntype", void 0)
], ShiftsController.prototype, "assign", null);
__decorate([
    (0, common_2.Delete)(':id/unassign'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_2.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ShiftsController.prototype, "unassign", null);
exports.ShiftsController = ShiftsController = __decorate([
    (0, common_1.Controller)('v2/shifts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin', 'scheduler'),
    __metadata("design:paramtypes", [shifts_service_1.ShiftsService])
], ShiftsController);
//# sourceMappingURL=shifts.controller.js.map