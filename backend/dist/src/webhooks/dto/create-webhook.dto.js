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
exports.CreateWebhookDto = void 0;
const class_validator_1 = require("class-validator");
const webhook_events_1 = require("../webhook-events");
class CreateWebhookDto {
    event_type;
    endpoint_url;
}
exports.CreateWebhookDto = CreateWebhookDto;
__decorate([
    (0, class_validator_1.IsIn)(webhook_events_1.SUPPORTED_WEBHOOK_EVENTS),
    __metadata("design:type", String)
], CreateWebhookDto.prototype, "event_type", void 0);
__decorate([
    (0, class_validator_1.IsUrl)({ protocols: ['http', 'https'], require_protocol: true }),
    __metadata("design:type", String)
], CreateWebhookDto.prototype, "endpoint_url", void 0);
//# sourceMappingURL=create-webhook.dto.js.map