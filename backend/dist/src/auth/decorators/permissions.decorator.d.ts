export declare const PERMISSIONS_KEY = "permissions";
export declare const ANY_PERMISSIONS_KEY = "any_permissions";
export declare const RequirePermission: (...permissions: string[]) => import("@nestjs/common").CustomDecorator<string>;
export declare const RequireAnyPermission: (...permissions: string[]) => import("@nestjs/common").CustomDecorator<string>;
