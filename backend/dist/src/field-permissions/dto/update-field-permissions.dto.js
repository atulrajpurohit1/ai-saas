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
exports.UpdateFieldPermissionsDto = exports.FieldPermissionInputDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const field_permissions_constants_1 = require("../field-permissions.constants");
class FieldPermissionInputDto {
    entity;
    field;
    can_view;
    can_edit;
}
exports.FieldPermissionInputDto = FieldPermissionInputDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(field_permissions_constants_1.FIELD_PERMISSION_ENTITIES),
    __metadata("design:type", String)
], FieldPermissionInputDto.prototype, "entity", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], FieldPermissionInputDto.prototype, "field", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], FieldPermissionInputDto.prototype, "can_view", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], FieldPermissionInputDto.prototype, "can_edit", void 0);
class UpdateFieldPermissionsDto {
    permissions;
}
exports.UpdateFieldPermissionsDto = UpdateFieldPermissionsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => FieldPermissionInputDto),
    __metadata("design:type", Array)
], UpdateFieldPermissionsDto.prototype, "permissions", void 0);
//# sourceMappingURL=update-field-permissions.dto.js.map