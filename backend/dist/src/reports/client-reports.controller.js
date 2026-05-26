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
exports.ClientReportsController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const reports_service_1 = require("./reports.service");
let ClientReportsController = class ClientReportsController {
    reportsService;
    constructor(reportsService) {
        this.reportsService = reportsService;
    }
    getClientContext(user) {
        if (user.role !== 'client' || !user.clientId || !user.tenantId) {
            throw new common_1.ForbiddenException('Client access required');
        }
        return {
            tenantId: user.tenantId,
            clientId: user.clientId,
            userId: user.sub,
        };
    }
    findAll(user) {
        const { tenantId, clientId, userId } = this.getClientContext(user);
        return this.reportsService.findAllForClient(tenantId, clientId, userId);
    }
    async download(user, id, res) {
        const { tenantId, clientId, userId } = this.getClientContext(user);
        const { buffer } = await this.reportsService.downloadForClient(tenantId, clientId, userId, id);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=daily-report-${id}.pdf`,
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    }
    findOne(user, id) {
        const { tenantId, clientId, userId } = this.getClientContext(user);
        return this.reportsService.findOneForClient(tenantId, clientId, userId, id);
    }
};
exports.ClientReportsController = ClientReportsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClientReportsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id/download'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ClientReportsController.prototype, "download", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClientReportsController.prototype, "findOne", null);
exports.ClientReportsController = ClientReportsController = __decorate([
    (0, common_1.Controller)('client/reports'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('client'),
    __metadata("design:paramtypes", [reports_service_1.ReportsService])
], ClientReportsController);
//# sourceMappingURL=client-reports.controller.js.map