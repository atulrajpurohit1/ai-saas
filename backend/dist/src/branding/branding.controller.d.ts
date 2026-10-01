import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { BrandingService } from './branding.service';
export declare class BrandingController {
    private readonly brandingService;
    constructor(brandingService: BrandingService);
    getPublicBranding(domain?: string, tenantSlug?: string): Promise<import("./branding.service").BrandingSnapshot>;
    getBranding(user: ActiveUser): Promise<import("./branding.service").BrandingSnapshot>;
}
