"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateGuardDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_guard_dto_1 = require("./create-guard.dto");
class UpdateGuardDto extends (0, mapped_types_1.PartialType)(create_guard_dto_1.CreateGuardDto) {
}
exports.UpdateGuardDto = UpdateGuardDto;
//# sourceMappingURL=update-guard.dto.js.map