"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePerformanceReviewDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_performance_review_dto_1 = require("./create-performance-review.dto");
class UpdatePerformanceReviewDto extends (0, mapped_types_1.PartialType)(create_performance_review_dto_1.CreatePerformanceReviewDto) {
}
exports.UpdatePerformanceReviewDto = UpdatePerformanceReviewDto;
//# sourceMappingURL=update-performance-review.dto.js.map