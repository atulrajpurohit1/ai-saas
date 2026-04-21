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
exports.DealsController = void 0;
const common_1 = require("@nestjs/common");
const deals_service_1 = require("./deals.service");
const create_deal_dto_1 = require("./dto/create-deal.dto");
const update_deal_stage_dto_1 = require("./dto/update-deal-stage.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let DealsController = class DealsController {
    dealsService;
    constructor(dealsService) {
        this.dealsService = dealsService;
    }
    create(createDealDto, req) {
        const user = req.user;
        return this.dealsService.create(createDealDto, user.tenantId, user.sub);
    }
    convert(leadId, req) {
        const user = req.user;
        return this.dealsService.convertLeadToDeal(leadId, user.tenantId, user.sub);
    }
    findAll(req) {
        const user = req.user;
        return this.dealsService.findAll(user.tenantId);
    }
    findOne(id, req) {
        const user = req.user;
        return this.dealsService.findOne(id, user.tenantId);
    }
    updateStage(id, updateDealStageDto, req) {
        const user = req.user;
        return this.dealsService.updateStage(id, updateDealStageDto, user.tenantId, user.sub);
    }
    remove(id, req) {
        const user = req.user;
        return this.dealsService.remove(id, user.tenantId, user.sub);
    }
};
exports.DealsController = DealsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_deal_dto_1.CreateDealDto, Object]),
    __metadata("design:returntype", void 0)
], DealsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('convert/:leadId'),
    __param(0, (0, common_1.Param)('leadId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DealsController.prototype, "convert", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DealsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DealsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id/stage'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_deal_stage_dto_1.UpdateDealStageDto, Object]),
    __metadata("design:returntype", void 0)
], DealsController.prototype, "updateStage", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DealsController.prototype, "remove", null);
exports.DealsController = DealsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('deals'),
    __metadata("design:paramtypes", [deals_service_1.DealsService])
], DealsController);
//# sourceMappingURL=deals.controller.js.map