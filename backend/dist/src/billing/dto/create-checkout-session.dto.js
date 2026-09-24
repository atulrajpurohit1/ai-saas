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
exports.CreateCheckoutSessionDto = void 0;
const class_validator_1 = require("class-validator");
const MODULES = ['LEAD_GEN', 'GUARD_TOUR', 'FINANCE'];
class CreateCheckoutSessionDto {
    modules;
    interval;
}
exports.CreateCheckoutSessionDto = CreateCheckoutSessionDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)({ message: 'Select at least one service to purchase.' }),
    (0, class_validator_1.IsIn)(MODULES, { each: true, message: 'Unknown service selected.' }),
    __metadata("design:type", Array)
], CreateCheckoutSessionDto.prototype, "modules", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['monthly', 'annual']),
    __metadata("design:type", String)
], CreateCheckoutSessionDto.prototype, "interval", void 0);
//# sourceMappingURL=create-checkout-session.dto.js.map