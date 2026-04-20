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
exports.UpdateLeadStatusDto = exports.LeadStatus = void 0;
const class_validator_1 = require("class-validator");
var LeadStatus;
(function (LeadStatus) {
    LeadStatus["NEW"] = "new";
    LeadStatus["CONTACTED"] = "contacted";
    LeadStatus["PROPOSAL_SENT"] = "proposal_sent";
    LeadStatus["RESPONDED"] = "responded";
    LeadStatus["CLOSED"] = "closed";
})(LeadStatus || (exports.LeadStatus = LeadStatus = {}));
class UpdateLeadStatusDto {
    status;
}
exports.UpdateLeadStatusDto = UpdateLeadStatusDto;
__decorate([
    (0, class_validator_1.IsEnum)(LeadStatus, {
        message: 'Status must be one of: new, contacted, proposal_sent, responded, closed',
    }),
    __metadata("design:type", String)
], UpdateLeadStatusDto.prototype, "status", void 0);
//# sourceMappingURL=update-lead-status.dto.js.map