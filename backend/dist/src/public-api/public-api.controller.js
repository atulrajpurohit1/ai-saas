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
exports.PublicApiController = void 0;
const common_1 = require("@nestjs/common");
const public_api_decorator_1 = require("./public-api.decorator");
const public_api_key_guard_1 = require("./public-api-key.guard");
const public_api_logging_interceptor_1 = require("./public-api-logging.interceptor");
const public_api_service_1 = require("./public-api.service");
let PublicApiController = class PublicApiController {
    publicApiService;
    constructor(publicApiService) {
        this.publicApiService = publicApiService;
    }
    listClients(request, query) {
        return this.publicApiService.listClients(request.publicApiKey, query);
    }
    createClient(request, body) {
        return this.publicApiService.createClient(request.publicApiKey, body);
    }
    listSites(request, query) {
        return this.publicApiService.listSites(request.publicApiKey, query);
    }
    createSite(request, body) {
        return this.publicApiService.createSite(request.publicApiKey, body);
    }
    listGuards(request, query) {
        return this.publicApiService.listGuards(request.publicApiKey, query);
    }
    createGuard(request, body) {
        return this.publicApiService.createGuard(request.publicApiKey, body);
    }
    listShifts(request, query) {
        return this.publicApiService.listShifts(request.publicApiKey, query);
    }
    createShift(request, body) {
        return this.publicApiService.createShift(request.publicApiKey, body);
    }
    assignShift(request, id, body) {
        return this.publicApiService.assignShift(request.publicApiKey, id, body);
    }
    listIncidents(request, query) {
        return this.publicApiService.listIncidents(request.publicApiKey, query);
    }
    createIncident(request, body) {
        return this.publicApiService.createIncident(request.publicApiKey, body);
    }
    listInvoices(request, query) {
        return this.publicApiService.listInvoices(request.publicApiKey, query);
    }
    listReports(request, query) {
        return this.publicApiService.listReports(request.publicApiKey, query);
    }
};
exports.PublicApiController = PublicApiController;
__decorate([
    (0, common_1.Get)('clients'),
    (0, public_api_decorator_1.RequirePublicApiPermission)('clients.read'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PublicApiController.prototype, "listClients", null);
__decorate([
    (0, common_1.Post)('clients'),
    (0, public_api_decorator_1.RequirePublicApiPermission)('clients.write'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PublicApiController.prototype, "createClient", null);
__decorate([
    (0, common_1.Get)('sites'),
    (0, public_api_decorator_1.RequirePublicApiPermission)('sites.read'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PublicApiController.prototype, "listSites", null);
__decorate([
    (0, common_1.Post)('sites'),
    (0, public_api_decorator_1.RequirePublicApiPermission)('sites.write'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PublicApiController.prototype, "createSite", null);
__decorate([
    (0, common_1.Get)('guards'),
    (0, public_api_decorator_1.RequirePublicApiPermission)('guards.read'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PublicApiController.prototype, "listGuards", null);
__decorate([
    (0, common_1.Post)('guards'),
    (0, public_api_decorator_1.RequirePublicApiPermission)('guards.write'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PublicApiController.prototype, "createGuard", null);
__decorate([
    (0, common_1.Get)('shifts'),
    (0, public_api_decorator_1.RequirePublicApiPermission)('shifts.read'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PublicApiController.prototype, "listShifts", null);
__decorate([
    (0, common_1.Post)('shifts'),
    (0, public_api_decorator_1.RequirePublicApiPermission)('shifts.write'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PublicApiController.prototype, "createShift", null);
__decorate([
    (0, common_1.Post)('shifts/:id/assign'),
    (0, public_api_decorator_1.RequirePublicApiPermission)('shifts.write'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], PublicApiController.prototype, "assignShift", null);
__decorate([
    (0, common_1.Get)('incidents'),
    (0, public_api_decorator_1.RequirePublicApiPermission)('incidents.read'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PublicApiController.prototype, "listIncidents", null);
__decorate([
    (0, common_1.Post)('incidents'),
    (0, public_api_decorator_1.RequirePublicApiPermission)('incidents.write'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PublicApiController.prototype, "createIncident", null);
__decorate([
    (0, common_1.Get)('invoices'),
    (0, public_api_decorator_1.RequirePublicApiPermission)('invoices.read'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PublicApiController.prototype, "listInvoices", null);
__decorate([
    (0, common_1.Get)('reports'),
    (0, public_api_decorator_1.RequirePublicApiPermission)('reports.read'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PublicApiController.prototype, "listReports", null);
exports.PublicApiController = PublicApiController = __decorate([
    (0, common_1.Controller)('public'),
    (0, common_1.UseGuards)(public_api_key_guard_1.PublicApiKeyGuard),
    (0, common_1.UseInterceptors)(public_api_logging_interceptor_1.PublicApiLoggingInterceptor),
    __metadata("design:paramtypes", [public_api_service_1.PublicApiService])
], PublicApiController);
//# sourceMappingURL=public-api.controller.js.map