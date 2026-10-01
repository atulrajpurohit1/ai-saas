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
const pricing_constants_1 = require("../pricing.constants");
class CreateCheckoutSessionDto {
    package;
    band;
}
exports.CreateCheckoutSessionDto = CreateCheckoutSessionDto;
__decorate([
    (0, class_validator_1.IsIn)(pricing_constants_1.PACKAGE_KEYS, { message: 'Unknown package selected.' }),
    __metadata("design:type", String)
], CreateCheckoutSessionDto.prototype, "package", void 0);
__decorate([
    (0, class_validator_1.IsIn)(pricing_constants_1.GUARD_BANDS.map((band) => band.key), {
        message: 'Unknown guard band selected.',
    }),
    __metadata("design:type", String)
], CreateCheckoutSessionDto.prototype, "band", void 0);
//# sourceMappingURL=create-checkout-session.dto.js.map