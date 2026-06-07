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
exports.CreateSSOProviderDto = exports.SSORoleMappingDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const sso_constants_1 = require("../sso.constants");
class SSORoleMappingDto {
    external_group;
    role_id;
    branch_id;
}
exports.SSORoleMappingDto = SSORoleMappingDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SSORoleMappingDto.prototype, "external_group", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SSORoleMappingDto.prototype, "role_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], SSORoleMappingDto.prototype, "branch_id", void 0);
class CreateSSOProviderDto {
    provider_type;
    provider_name;
    client_id;
    client_secret;
    issuer_url;
    metadata_url;
    saml_metadata;
    email_domains;
    auto_provision;
    default_role_id;
    default_branch_id;
    status;
    role_mappings;
}
exports.CreateSSOProviderDto = CreateSSOProviderDto;
__decorate([
    (0, class_validator_1.IsIn)(sso_constants_1.SSO_PROVIDER_TYPES),
    __metadata("design:type", String)
], CreateSSOProviderDto.prototype, "provider_type", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSSOProviderDto.prototype, "provider_name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSSOProviderDto.prototype, "client_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSSOProviderDto.prototype, "client_secret", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)({ require_protocol: true }),
    __metadata("design:type", String)
], CreateSSOProviderDto.prototype, "issuer_url", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)({ require_protocol: true }),
    __metadata("design:type", String)
], CreateSSOProviderDto.prototype, "metadata_url", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSSOProviderDto.prototype, "saml_metadata", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateSSOProviderDto.prototype, "email_domains", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateSSOProviderDto.prototype, "auto_provision", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], CreateSSOProviderDto.prototype, "default_role_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], CreateSSOProviderDto.prototype, "default_branch_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['active', 'inactive']),
    __metadata("design:type", String)
], CreateSSOProviderDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SSORoleMappingDto),
    __metadata("design:type", Array)
], CreateSSOProviderDto.prototype, "role_mappings", void 0);
//# sourceMappingURL=create-sso-provider.dto.js.map