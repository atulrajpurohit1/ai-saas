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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateDealDto = exports.DealStage = void 0;
const class_validator_1 = require("class-validator");
var DealStage;
(function (DealStage) {
    DealStage["NEW"] = "New";
    DealStage["CONTACTED"] = "Contacted";
    DealStage["PROPOSAL"] = "Proposal";
    DealStage["WON"] = "Won";
    DealStage["LOST"] = "Lost";
})(DealStage || (exports.DealStage = DealStage = {}));
class CreateDealDto {
    name;
    leadId;
    stage;
}
exports.CreateDealDto = CreateDealDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateDealDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateDealDto.prototype, "leadId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(DealStage),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateDealDto.prototype, "stage", void 0);
//# sourceMappingURL=create-deal.dto.js.map