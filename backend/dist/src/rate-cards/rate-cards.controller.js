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
exports.RateCardsController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const create_rate_card_dto_1 = require("./dto/create-rate-card.dto");
const update_rate_card_dto_1 = require("./dto/update-rate-card.dto");
const rate_cards_service_1 = require("./rate-cards.service");
let RateCardsController = class RateCardsController {
    rateCardsService;
    constructor(rateCardsService) {
        this.rateCardsService = rateCardsService;
    }
    create(user, dto) {
        return this.rateCardsService.create(user.tenantId, user.sub, dto);
    }
    findAll(user, status) {
        return this.rateCardsService.findAll(user.tenantId, status);
    }
    findOne(user, id) {
        return this.rateCardsService.findOne(user.tenantId, id);
    }
    update(user, id, dto) {
        return this.rateCardsService.update(user.tenantId, user.sub, id, dto);
    }
    deactivate(user, id) {
        return this.rateCardsService.deactivate(user.tenantId, user.sub, id);
    }
};
exports.RateCardsController = RateCardsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_rate_card_dto_1.CreateRateCardDto]),
    __metadata("design:returntype", void 0)
], RateCardsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], RateCardsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], RateCardsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_rate_card_dto_1.UpdateRateCardDto]),
    __metadata("design:returntype", void 0)
], RateCardsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], RateCardsController.prototype, "deactivate", null);
exports.RateCardsController = RateCardsController = __decorate([
    (0, common_1.Controller)('rate-cards'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __metadata("design:paramtypes", [rate_cards_service_1.RateCardsService])
], RateCardsController);
//# sourceMappingURL=rate-cards.controller.js.map