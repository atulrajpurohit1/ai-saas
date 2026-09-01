"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateClientInsurancePolicyDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_client_insurance_policy_dto_1 = require("./create-client-insurance-policy.dto");
class UpdateClientInsurancePolicyDto extends (0, mapped_types_1.PartialType)((0, mapped_types_1.OmitType)(create_client_insurance_policy_dto_1.CreateClientInsurancePolicyDto, ['client_id'])) {
}
exports.UpdateClientInsurancePolicyDto = UpdateClientInsurancePolicyDto;
//# sourceMappingURL=update-client-insurance-policy.dto.js.map