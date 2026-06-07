import { Request } from 'express';
import { RolesService } from '../roles/roles.service';
import { BrandingService } from '../branding/branding.service';
export declare class UsersController {
    private readonly rolesService;
    private readonly brandingService;
    constructor(rolesService: RolesService, brandingService: BrandingService);
    getMe(req: Request): Promise<{
        branding: import("../branding/branding.service").BrandingSnapshot;
        id: string;
        email: string;
        name: string | null;
        role: string;
        tenantId: string;
        tenantName: string;
        branchId: string | null;
        branch: {
            id: string;
            name: string;
        } | null;
        isSuperAdmin: boolean;
        roles: {
            assignmentId: string;
            id: string;
            name: string;
            description: string | null;
            isSystemRole: boolean;
            branchId: string | null;
            branch: {
                id: string;
                name: string;
            } | null;
        }[];
        permissions: string[];
    }>;
}
