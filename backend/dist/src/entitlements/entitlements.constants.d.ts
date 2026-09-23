import { ServiceModule } from '@prisma/client';
export declare const SERVICE_MODULES: ServiceModule[];
export declare const SERVICE_MODULE_LABELS: Record<ServiceModule, string>;
export declare const PERMISSION_MODULE_TO_SERVICE: Record<string, ServiceModule>;
export declare const CORE_PERMISSION_MODULES: readonly ["dashboard", "identity", "settings", "billing", "audit", "integrations", "branches", "clients", "sites", "documents", "notes", "activities", "ai"];
export declare function serviceForPermissionModule(permissionModule: string): ServiceModule | null;
export declare function isServiceModule(value: string): value is ServiceModule;
