import { Request } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { BrandingService } from './branding.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';
export declare class BrandingController {
    private readonly brandingService;
    constructor(brandingService: BrandingService);
    publicBranding(domain: string | undefined, tenantSlug: string | undefined, req: Request): Promise<import("./branding.service").BrandingSnapshot>;
    getBranding(user: ActiveUser): Promise<import("./branding.service").BrandingSnapshot>;
    updateBranding(user: ActiveUser, dto: UpdateBrandingDto): Promise<import("./branding.service").BrandingSnapshot>;
    listDomains(user: ActiveUser): Promise<{
        id: any;
        tenant_id: any;
        domain: any;
        verification_status: any;
        ssl_status: any;
        verification_token: any;
        verification_record: string;
        verified_at: any;
        created_at: any;
        updated_at: any;
    }[]>;
    addDomain(user: ActiveUser, dto: CreateDomainDto): Promise<{
        id: any;
        tenant_id: any;
        domain: any;
        verification_status: any;
        ssl_status: any;
        verification_token: any;
        verification_record: string;
        verified_at: any;
        created_at: any;
        updated_at: any;
    }>;
    verifyDomain(user: ActiveUser, id: string): Promise<{
        id: any;
        tenant_id: any;
        domain: any;
        verification_status: any;
        ssl_status: any;
        verification_token: any;
        verification_record: string;
        verified_at: any;
        created_at: any;
        updated_at: any;
    } | {
        verification_error: string;
        id: any;
        tenant_id: any;
        domain: any;
        verification_status: any;
        ssl_status: any;
        verification_token: any;
        verification_record: string;
        verified_at: any;
        created_at: any;
        updated_at: any;
    }>;
}
