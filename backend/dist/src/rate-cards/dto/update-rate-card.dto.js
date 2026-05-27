"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateRateCardDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_rate_card_dto_1 = require("./create-rate-card.dto");
class UpdateRateCardDto extends (0, mapped_types_1.PartialType)(create_rate_card_dto_1.CreateRateCardDto) {
}
exports.UpdateRateCardDto = UpdateRateCardDto;
//# sourceMappingURL=update-rate-card.dto.js.map