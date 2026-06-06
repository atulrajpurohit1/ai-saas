import { SetMetadata } from '@nestjs/common';

export const PUBLIC_API_PERMISSION_KEY = 'public_api_permission';

export const RequirePublicApiPermission = (permission: string) =>
  SetMetadata(PUBLIC_API_PERMISSION_KEY, permission);
