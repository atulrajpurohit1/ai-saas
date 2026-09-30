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
exports.GrantCreditsDto = void 0;
const class_validator_1 = require("class-validator");
class GrantCreditsDto {
    amount;
    reason;
}
exports.GrantCreditsDto = GrantCreditsDto;
__decorate([
    (0, class_validator_1.IsInt)({ message: 'Credit amount must be a whole number.' }),
    (0, class_validator_1.Min)(-100_000),
    (0, class_validator_1.Max)(100_000),
    __metadata("design:type", Number)
], GrantCreditsDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Give a reason for this adjustment.' }),
    __metadata("design:type", String)
], GrantCreditsDto.prototype, "reason", void 0);
//# sourceMappingURL=grant-credits.dto.js.map