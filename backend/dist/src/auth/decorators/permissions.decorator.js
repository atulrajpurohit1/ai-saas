"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequireAnyPermission = exports.RequirePermission = exports.ANY_PERMISSIONS_KEY = exports.PERMISSIONS_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.PERMISSIONS_KEY = 'permissions';
exports.ANY_PERMISSIONS_KEY = 'any_permissions';
const RequirePermission = (...permissions) => (0, common_1.SetMetadata)(exports.PERMISSIONS_KEY, permissions);
exports.RequirePermission = RequirePermission;
const RequireAnyPermission = (...permissions) => (0, common_1.SetMetadata)(exports.ANY_PERMISSIONS_KEY, permissions);
exports.RequireAnyPermission = RequireAnyPermission;
//# sourceMappingURL=permissions.decorator.js.map