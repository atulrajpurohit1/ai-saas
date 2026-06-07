"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSSOProviderDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_sso_provider_dto_1 = require("./create-sso-provider.dto");
class UpdateSSOProviderDto extends (0, mapped_types_1.PartialType)(create_sso_provider_dto_1.CreateSSOProviderDto) {
}
exports.UpdateSSOProviderDto = UpdateSSOProviderDto;
//# sourceMappingURL=update-sso-provider.dto.js.map