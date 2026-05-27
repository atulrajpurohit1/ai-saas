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
exports.TimesheetsController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const correct_timesheet_dto_1 = require("./dto/correct-timesheet.dto");
const reject_timesheet_dto_1 = require("./dto/reject-timesheet.dto");
const timesheets_service_1 = require("./timesheets.service");
let TimesheetsController = class TimesheetsController {
    timesheetsService;
    constructor(timesheetsService) {
        this.timesheetsService = timesheetsService;
    }
    findAll(user, status) {
        return this.timesheetsService.findAllForAdmin(user.tenantId, status);
    }
    findOne(user, id) {
        return this.timesheetsService.findOneForAdmin(user.tenantId, id);
    }
    approve(user, id) {
        return this.timesheetsService.approve({
            tenantId: user.tenantId,
            userId: user.sub,
            userRole: user.role,
            guardId: user.guardId,
            timesheetId: id,
        });
    }
    reject(user, id, dto) {
        return this.timesheetsService.reject(user.tenantId, user.sub, id, dto);
    }
    correct(user, id, dto) {
        return this.timesheetsService.correct(user.tenantId, user.sub, id, dto);
    }
};
exports.TimesheetsController = TimesheetsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TimesheetsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TimesheetsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TimesheetsController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reject_timesheet_dto_1.RejectTimesheetDto]),
    __metadata("design:returntype", void 0)
], TimesheetsController.prototype, "reject", null);
__decorate([
    (0, common_1.Put)(':id/correct'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, correct_timesheet_dto_1.CorrectTimesheetDto]),
    __metadata("design:returntype", void 0)
], TimesheetsController.prototype, "correct", null);
exports.TimesheetsController = TimesheetsController = __decorate([
    (0, common_1.Controller)('timesheets'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin', 'supervisor'),
    __metadata("design:paramtypes", [timesheets_service_1.TimesheetsService])
], TimesheetsController);
//# sourceMappingURL=timesheets.controller.js.map