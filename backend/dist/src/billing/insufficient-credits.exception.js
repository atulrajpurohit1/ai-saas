"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsufficientCreditsException = void 0;
const common_1 = require("@nestjs/common");
class InsufficientCreditsException extends common_1.HttpException {
    required;
    available;
    constructor(message, required, available) {
        super({
            statusCode: common_1.HttpStatus.PAYMENT_REQUIRED,
            error: 'Payment Required',
            code: 'INSUFFICIENT_CREDITS',
            message,
            required,
            available,
        }, common_1.HttpStatus.PAYMENT_REQUIRED);
        this.required = required;
        this.available = available;
    }
}
exports.InsufficientCreditsException = InsufficientCreditsException;
//# sourceMappingURL=insufficient-credits.exception.js.map