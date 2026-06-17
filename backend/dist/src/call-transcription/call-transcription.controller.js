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
exports.CallTranscriptionController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const call_transcription_service_1 = require("./call-transcription.service");
let CallTranscriptionController = class CallTranscriptionController {
    callTranscriptionService;
    constructor(callTranscriptionService) {
        this.callTranscriptionService = callTranscriptionService;
    }
    status() {
        return this.callTranscriptionService.getStatus();
    }
    transcribe(file) {
        if (!file)
            throw new common_1.BadRequestException('No audio file uploaded');
        return this.callTranscriptionService.transcribe(file);
    }
};
exports.CallTranscriptionController = CallTranscriptionController;
__decorate([
    (0, common_1.Get)('status'),
    (0, permissions_decorator_1.RequireAnyPermission)('ai.view', 'leads.view', 'deals.view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CallTranscriptionController.prototype, "status", null);
__decorate([
    (0, common_1.Post)('transcribe'),
    (0, permissions_decorator_1.RequireAnyPermission)('ai.view', 'leads.view', 'deals.view'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        limits: { fileSize: 25 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallTranscriptionController.prototype, "transcribe", null);
exports.CallTranscriptionController = CallTranscriptionController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, common_1.Controller)('call-transcription'),
    __metadata("design:paramtypes", [call_transcription_service_1.CallTranscriptionService])
], CallTranscriptionController);
//# sourceMappingURL=call-transcription.controller.js.map