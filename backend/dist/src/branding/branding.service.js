"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrandingService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const dns_1 = require("dns");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
let BrandingService = class BrandingService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async getForTenant(tenantId) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            include: { branding: true },
        });
        if (!tenant)
            throw new common_1.NotFoundException('Tenant not found');
        return this.serializeBranding(tenant);
    }
    async getForUser(user) {
        return this.getForTenant(user.tenantId);
    }
    async getPublicBranding(input) {
        const domain = this.normalizeDomain(input.domain || '');
        const tenantSlug = input.tenantSlug?.trim().toLowerCase();
        const tenant = domain
            ? await this.prisma.tenant.findFirst({
                where: {
                    customDomains: {
                        some: {
                            domain,
                            verificationStatus: 'verified',
                        },
                    },
                },
                include: { branding: true },
            })
            : tenantSlug
                ? await this.prisma.tenant.findUnique({
                    where: { slug: tenantSlug },
                    include: { branding: true },
                })
                : null;
        if (!tenant) {
            return this.defaultBranding();
        }
        return this.serializeBranding(tenant);
    }
    async updateBranding(user, dto) {
        const before = await this.getForTenant(user.tenantId);
        const branding = await this.prisma.tenantBranding.upsert({
            where: { tenantId: user.tenantId },
            update: {
                ...(dto.company_name !== undefined ? { companyName: this.nullable(dto.company_name) } : {}),
                ...(dto.logo_url !== undefined ? { logoUrl: this.nullable(dto.logo_url) } : {}),
                ...(dto.favicon_url !== undefined ? { faviconUrl: this.nullable(dto.favicon_url) } : {}),
                ...(dto.primary_color !== undefined ? { primaryColor: dto.primary_color } : {}),
                ...(dto.secondary_color !== undefined ? { secondaryColor: dto.secondary_color } : {}),
                ...(dto.accent_color !== undefined ? { accentColor: dto.accent_color } : {}),
                ...(dto.login_background !== undefined ? { loginBackground: this.nullable(dto.login_background) } : {}),
                ...(dto.welcome_message !== undefined ? { welcomeMessage: this.nullable(dto.welcome_message) } : {}),
                ...(dto.support_email !== undefined ? { supportEmail: this.nullable(dto.support_email) } : {}),
                ...(dto.support_phone !== undefined ? { supportPhone: this.nullable(dto.support_phone) } : {}),
            },
            create: {
                tenantId: user.tenantId,
                companyName: this.nullable(dto.company_name),
                logoUrl: this.nullable(dto.logo_url),
                faviconUrl: this.nullable(dto.favicon_url),
                primaryColor: dto.primary_color || '#6366f1',
                secondaryColor: dto.secondary_color || '#334155',
                accentColor: dto.accent_color || '#818cf8',
                loginBackground: this.nullable(dto.login_background),
                welcomeMessage: this.nullable(dto.welcome_message),
                supportEmail: this.nullable(dto.support_email),
                supportPhone: this.nullable(dto.support_phone),
            },
        });
        const changedLogo = before.logo_url !== branding.logoUrl;
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: changedLogo ? 'BRANDING_LOGO_CHANGED' : 'BRANDING_UPDATED',
            entityType: 'TenantBranding',
            entityId: branding.id,
            details: changedLogo ? 'Tenant logo changed' : 'Tenant branding updated',
        });
        if (before.primary_color !== branding.primaryColor ||
            before.secondary_color !== branding.secondaryColor ||
            before.accent_color !== branding.accentColor) {
            await this.auditService.log({
                tenantId: user.tenantId,
                userId: user.sub,
                action: 'THEME_UPDATED',
                entityType: 'TenantBranding',
                entityId: branding.id,
                details: 'Tenant theme colors updated',
            });
        }
        return this.getForTenant(user.tenantId);
    }
    async listDomains(user) {
        const domains = await this.prisma.customDomain.findMany({
            where: { tenantId: user.tenantId },
            orderBy: { createdAt: 'desc' },
        });
        return domains.map((domain) => this.serializeDomain(domain));
    }
    async addDomain(user, dto) {
        const domain = this.normalizeDomain(dto.domain);
        if (!domain)
            throw new common_1.BadRequestException('domain is required');
        const verificationToken = `ai-saas-${(0, crypto_1.randomBytes)(16).toString('hex')}`;
        const created = await this.prisma.customDomain.create({
            data: {
                tenantId: user.tenantId,
                domain,
                verificationToken,
            },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'CUSTOM_DOMAIN_ADDED',
            entityType: 'CustomDomain',
            entityId: created.id,
            details: `Domain ${domain} added for verification`,
        });
        return this.serializeDomain(created);
    }
    async verifyDomain(user, id) {
        const domain = await this.prisma.customDomain.findFirst({
            where: { id, tenantId: user.tenantId },
        });
        if (!domain)
            throw new common_1.NotFoundException('Domain not found');
        const verified = await this.hasVerificationTxtRecord(domain.domain, domain.verificationToken);
        if (!verified) {
            return {
                ...this.serializeDomain(domain),
                verification_error: `Add TXT record _ai-saas.${domain.domain} with value ${domain.verificationToken}`,
            };
        }
        const updated = await this.prisma.customDomain.update({
            where: { id },
            data: {
                verificationStatus: 'verified',
                sslStatus: domain.sslStatus === 'active' ? 'active' : 'provisioning',
                verifiedAt: new Date(),
            },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'CUSTOM_DOMAIN_VERIFIED',
            entityType: 'CustomDomain',
            entityId: updated.id,
            details: `Domain ${updated.domain} verified`,
        });
        return this.serializeDomain(updated);
    }
    async brandingSnapshot(tenantId) {
        return this.getForTenant(tenantId);
    }
    addPdfHeader(doc, title, branding) {
        const primary = this.safeHex(branding.primary_color, '#111827');
        const secondary = this.safeHex(branding.secondary_color, '#4b5563');
        const accent = this.safeHex(branding.accent_color, primary);
        const startY = doc.y;
        this.tryAddPdfLogo(doc, branding.logo_url, 50, startY, 72, 36);
        doc.rect(50, startY + 45, 512, 3).fillColor(accent).fill();
        doc.fillColor(primary).fontSize(22).text(title, 132, startY, { align: 'right', width: 430 });
        doc.fillColor(secondary).fontSize(11).text(branding.company_name, 132, startY + 27, { align: 'right', width: 430 });
        if (branding.support_email || branding.support_phone) {
            doc.fillColor(secondary).fontSize(9).text([branding.support_email, branding.support_phone].filter(Boolean).join(' | '), 132, startY + 42, { align: 'right', width: 430 });
        }
        doc.y = startY + 68;
    }
    emailShell(branding, title, bodyHtml) {
        const primary = this.safeHex(branding.primary_color, '#4f46e5');
        const accent = this.safeHex(branding.accent_color, primary);
        const logo = branding.logo_url
            ? `<img src="${branding.logo_url}" alt="${branding.company_name}" style="max-height:48px; max-width:180px; display:block; margin-bottom:18px;" />`
            : `<div style="font-size:22px; font-weight:800; color:${primary}; margin-bottom:18px;">${branding.company_name}</div>`;
        return `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1f2937; background: #ffffff;">
        <div style="border-top: 4px solid ${accent}; padding: 24px 24px 12px;">
          ${logo}
          <h2 style="color: ${primary}; margin: 0;">${title}</h2>
        </div>
        <div style="padding: 8px 24px 24px;">
          ${bodyHtml}
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding: 16px 24px; color: #6b7280; font-size: 12px;">
          ${branding.support_email ? `Support: ${branding.support_email}` : ''}
          ${branding.support_phone ? `${branding.support_email ? ' | ' : ''}${branding.support_phone}` : ''}
        </div>
      </div>
    `;
    }
    async hasVerificationTxtRecord(domain, token) {
        try {
            const records = await dns_1.promises.resolveTxt(`_ai-saas.${domain}`);
            return records.flat().some((value) => value.trim() === token);
        }
        catch {
            return false;
        }
    }
    serializeBranding(tenant) {
        const branding = tenant.branding;
        return {
            company_name: branding?.companyName || tenant.name,
            logo_url: branding?.logoUrl || null,
            favicon_url: branding?.faviconUrl || null,
            primary_color: branding?.primaryColor || '#6366f1',
            secondary_color: branding?.secondaryColor || '#334155',
            accent_color: branding?.accentColor || '#818cf8',
            login_background: branding?.loginBackground || null,
            welcome_message: branding?.welcomeMessage || null,
            support_email: branding?.supportEmail || null,
            support_phone: branding?.supportPhone || null,
        };
    }
    defaultBranding() {
        return {
            company_name: 'Ai Saas',
            logo_url: null,
            favicon_url: null,
            primary_color: '#6366f1',
            secondary_color: '#334155',
            accent_color: '#818cf8',
            login_background: null,
            welcome_message: null,
            support_email: null,
            support_phone: null,
        };
    }
    serializeDomain(domain) {
        return {
            id: domain.id,
            tenant_id: domain.tenantId,
            domain: domain.domain,
            verification_status: domain.verificationStatus,
            ssl_status: domain.sslStatus,
            verification_token: domain.verificationToken,
            verification_record: `_ai-saas.${domain.domain}`,
            verified_at: domain.verifiedAt,
            created_at: domain.createdAt,
            updated_at: domain.updatedAt,
        };
    }
    normalizeDomain(domain) {
        return domain
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/\/.*$/, '')
            .replace(/:\d+$/, '');
    }
    nullable(value) {
        const trimmed = value?.trim();
        return trimmed || null;
    }
    tryAddPdfLogo(doc, logoUrl, x, y, width, height) {
        if (!logoUrl?.startsWith('data:image/')) {
            doc.fontSize(15).fillColor('#111827').text('LOGO', x, y + 10, { width });
            return;
        }
        try {
            const base64 = logoUrl.split(',')[1];
            if (!base64)
                throw new Error('Missing logo data');
            doc.image(Buffer.from(base64, 'base64'), x, y, { fit: [width, height] });
        }
        catch {
            doc.fontSize(15).fillColor('#111827').text('LOGO', x, y + 10, { width });
        }
    }
    safeHex(value, fallback) {
        return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
    }
};
exports.BrandingService = BrandingService;
exports.BrandingService = BrandingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], BrandingService);
//# sourceMappingURL=branding.service.js.map