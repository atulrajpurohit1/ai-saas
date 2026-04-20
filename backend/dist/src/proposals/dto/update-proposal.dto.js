"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateProposalDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_proposal_dto_1 = require("./create-proposal.dto");
class UpdateProposalDto extends (0, mapped_types_1.PartialType)(create_proposal_dto_1.CreateProposalDto) {
}
exports.UpdateProposalDto = UpdateProposalDto;
//# sourceMappingURL=update-proposal.dto.js.map