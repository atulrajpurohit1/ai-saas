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
exports.PurchaseCreditsDto = void 0;
const class_validator_1 = require("class-validator");
const credit_packs_constants_1 = require("../credit-packs.constants");
class PurchaseCreditsDto {
    pack;
}
exports.PurchaseCreditsDto = PurchaseCreditsDto;
__decorate([
    (0, class_validator_1.IsIn)(credit_packs_constants_1.CREDIT_PACK_KEYS, { message: 'Unknown credit pack selected.' }),
    __metadata("design:type", String)
], PurchaseCreditsDto.prototype, "pack", void 0);
//# sourceMappingURL=purchase-credits.dto.js.map