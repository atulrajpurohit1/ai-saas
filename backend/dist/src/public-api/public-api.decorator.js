"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequirePublicApiPermission = exports.PUBLIC_API_PERMISSION_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.PUBLIC_API_PERMISSION_KEY = 'public_api_permission';
const RequirePublicApiPermission = (permission) => (0, common_1.SetMetadata)(exports.PUBLIC_API_PERMISSION_KEY, permission);
exports.RequirePublicApiPermission = RequirePublicApiPermission;
//# sourceMappingURL=public-api.decorator.js.map