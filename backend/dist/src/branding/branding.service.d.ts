import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';
export type BrandingSnapshot = {
    company_name: string;
    logo_url: string | null;
    favicon_url: string | null;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    login_background: string | null;
    welcome_message: string | null;
    support_email: string | null;
    support_phone: string | null;
};
export declare class BrandingService {
    private readonly prisma;
    private readonly auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    getForTenant(tenantId: string): Promise<BrandingSnapshot>;
    getForUser(user: ActiveUser): Promise<BrandingSnapshot>;
    getPublicBranding(input: {
        domain?: string;
        tenantSlug?: string;
    }): Promise<BrandingSnapshot>;
    updateBranding(user: ActiveUser, dto: UpdateBrandingDto): Promise<BrandingSnapshot>;
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
    brandingSnapshot(tenantId: string): Promise<BrandingSnapshot>;
    addPdfHeader(doc: any, title: string, branding: BrandingSnapshot): void;
    emailShell(branding: BrandingSnapshot, title: string, bodyHtml: string): string;
    private hasVerificationTxtRecord;
    private serializeBranding;
    private defaultBranding;
    private serializeDomain;
    private normalizeDomain;
    private nullable;
    private tryAddPdfLogo;
    private safeHex;
}
