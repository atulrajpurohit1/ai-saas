"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateGuardComplianceDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_guard_compliance_dto_1 = require("./create-guard-compliance.dto");
class UpdateGuardComplianceDto extends (0, mapped_types_1.PartialType)((0, mapped_types_1.OmitType)(create_guard_compliance_dto_1.CreateGuardComplianceDto, ['guard_id'])) {
}
exports.UpdateGuardComplianceDto = UpdateGuardComplianceDto;
//# sourceMappingURL=update-guard-compliance.dto.js.map