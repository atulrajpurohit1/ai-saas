"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequireModule = exports.SERVICE_MODULES_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.SERVICE_MODULES_KEY = 'service_modules';
const RequireModule = (...modules) => (0, common_1.SetMetadata)(exports.SERVICE_MODULES_KEY, modules);
exports.RequireModule = RequireModule;
//# sourceMappingURL=module.decorator.js.map