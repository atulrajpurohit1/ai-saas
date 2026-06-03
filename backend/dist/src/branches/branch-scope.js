"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.branchWhere = branchWhere;
exports.resolveWriteBranchId = resolveWriteBranchId;
exports.branchScopedWhere = branchScopedWhere;
const common_1 = require("@nestjs/common");
function branchWhere(user, requestedBranchId) {
    if (user.isSuperAdmin) {
        return requestedBranchId ? { branchId: requestedBranchId } : {};
    }
    if (!user.branchId) {
        return { branchId: null };
    }
    if (requestedBranchId && requestedBranchId !== user.branchId) {
        throw new common_1.ForbiddenException('You do not have access to this branch');
    }
    return {
        OR: [{ branchId: user.branchId }, { branchId: null }],
    };
}
function resolveWriteBranchId(user, requestedBranchId) {
    if (user.isSuperAdmin) {
        return requestedBranchId?.trim() || null;
    }
    if (!user.branchId) {
        return null;
    }
    if (requestedBranchId && requestedBranchId !== user.branchId) {
        throw new common_1.ForbiddenException('You cannot write records to another branch');
    }
    return user.branchId;
}
function branchScopedWhere(user, requestedBranchId) {
    return {
        tenantId: user.tenantId,
        ...branchWhere(user, requestedBranchId),
    };
}
//# sourceMappingURL=branch-scope.js.map