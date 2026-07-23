"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateRfpDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_rfp_dto_1 = require("./create-rfp.dto");
class UpdateRfpDto extends (0, mapped_types_1.PartialType)(create_rfp_dto_1.CreateRfpDto) {
}
exports.UpdateRfpDto = UpdateRfpDto;
//# sourceMappingURL=update-rfp.dto.js.map