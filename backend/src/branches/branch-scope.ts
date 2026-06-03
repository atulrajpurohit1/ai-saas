import { ForbiddenException } from '@nestjs/common';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

export type BranchAccessScope = {
  tenantId: string;
  requestedBranchId?: string | null;
};

export function branchWhere(user: ActiveUser, requestedBranchId?: string | null) {
  if (user.isSuperAdmin) {
    return requestedBranchId ? { branchId: requestedBranchId } : {};
  }

  if (!user.branchId) {
    return { branchId: null };
  }

  if (requestedBranchId && requestedBranchId !== user.branchId) {
    throw new ForbiddenException('You do not have access to this branch');
  }

  return {
    OR: [{ branchId: user.branchId }, { branchId: null }],
  };
}

export function resolveWriteBranchId(user: ActiveUser, requestedBranchId?: string | null) {
  if (user.isSuperAdmin) {
    return requestedBranchId?.trim() || null;
  }

  if (!user.branchId) {
    return null;
  }

  if (requestedBranchId && requestedBranchId !== user.branchId) {
    throw new ForbiddenException('You cannot write records to another branch');
  }

  return user.branchId;
}

export function branchScopedWhere(user: ActiveUser, requestedBranchId?: string | null) {
  return {
    tenantId: user.tenantId,
    ...branchWhere(user, requestedBranchId),
  };
}
