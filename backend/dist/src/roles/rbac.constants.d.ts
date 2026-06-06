export type PermissionDefinition = {
    key: string;
    name: string;
    description: string;
    module: string;
};
export declare const PERMISSIONS: PermissionDefinition[];
export declare const ALL_PERMISSION_KEYS: string[];
export type SystemRoleDefinition = {
    name: string;
    description: string;
    permissions: string[] | '*';
};
export declare const SYSTEM_ROLES: SystemRoleDefinition[];
export declare function systemRolePermissionKeys(roleName: string): string[];
export declare function roleToPortalRole(roleName: string): string;
