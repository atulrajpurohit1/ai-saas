"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailVerificationModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../prisma/prisma.module");
const email_module_1 = require("../email/email.module");
const email_validation_service_1 = require("./email-validation.service");
const email_verification_service_1 = require("./email-verification.service");
let EmailVerificationModule = class EmailVerificationModule {
};
exports.EmailVerificationModule = EmailVerificationModule;
exports.EmailVerificationModule = EmailVerificationModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, email_module_1.EmailModule],
        providers: [email_validation_service_1.EmailValidationService, email_verification_service_1.EmailVerificationService],
        exports: [email_validation_service_1.EmailValidationService, email_verification_service_1.EmailVerificationService],
    })
], EmailVerificationModule);
//# sourceMappingURL=email-verification.module.js.map