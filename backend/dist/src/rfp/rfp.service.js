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
exports.RfpService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
const audit_service_1 = require("../audit/audit.service");
const branding_service_1 = require("../branding/branding.service");
let RfpService = class RfpService {
    prisma;
    aiService;
    auditService;
    brandingService;
    constructor(prisma, aiService, auditService, brandingService) {
        this.prisma = prisma;
        this.aiService = aiService;
        this.auditService = auditService;
        this.brandingService = brandingService;
    }
    parseOptionalDate(value, fieldName) {
        if (!value)
            return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            throw new common_1.BadRequestException(`${fieldName} must be a valid date`);
        }
        return parsed;
    }
    normalizeSecurityTypes(value) {
        if (!Array.isArray(value))
            return [];
        return value
            .filter((item) => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean);
    }
    async findRfpOrThrow(tenantId, id) {
        const rfp = await this.prisma.rfp.findFirst({ where: { id, tenantId } });
        if (!rfp) {
            throw new common_1.NotFoundException('RFP not found');
        }
        return rfp;
    }
    async create(tenantId, userId, dto) {
        const rfp = await this.prisma.rfp.create({
            data: {
                tenantId,
                title: dto.title.trim(),
                clientName: dto.clientName.trim(),
                companyName: dto.companyName?.trim() || null,
                industry: dto.industry?.trim() || null,
                projectName: dto.projectName?.trim() || null,
                dueDate: this.parseOptionalDate(dto.dueDate, 'dueDate'),
                startDate: this.parseOptionalDate(dto.startDate, 'startDate'),
                endDate: this.parseOptionalDate(dto.endDate, 'endDate'),
                estimatedBudget: dto.estimatedBudget ?? null,
                securityTypes: this.normalizeSecurityTypes(dto.securityTypes),
                numberOfLocations: dto.numberOfLocations ?? null,
                address: dto.address?.trim() || null,
                operatingHours: dto.operatingHours?.trim() || null,
                guardsRequired: dto.guardsRequired ?? null,
                additionalRequirements: dto.additionalRequirements?.trim() || null,
                generatedContent: dto.generatedContent ?? null,
                status: dto.status || 'DRAFT',
                createdBy: userId,
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'CREATE',
            entityType: 'Rfp',
            entityId: rfp.id,
            details: `Created RFP: ${rfp.title}`,
        });
        return rfp;
    }
    async attachCreators(rfps) {
        const creatorIds = Array.from(new Set(rfps
            .map((rfp) => rfp.createdBy)
            .filter((id) => Boolean(id))));
        if (creatorIds.length === 0) {
            return rfps.map((rfp) => ({
                ...rfp,
                createdByUser: null,
            }));
        }
        const users = await this.prisma.user.findMany({
            where: { id: { in: creatorIds } },
            select: { id: true, name: true, email: true },
        });
        const usersById = new Map(users.map((user) => [user.id, user]));
        return rfps.map((rfp) => ({
            ...rfp,
            createdByUser: rfp.createdBy
                ? (usersById.get(rfp.createdBy) ?? null)
                : null,
        }));
    }
    async findAll(tenantId) {
        const rfps = await this.prisma.rfp.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
        });
        return this.attachCreators(rfps);
    }
    async findOne(tenantId, id) {
        const rfp = await this.findRfpOrThrow(tenantId, id);
        const [withCreator] = await this.attachCreators([rfp]);
        return withCreator;
    }
    async update(tenantId, userId, id, dto) {
        await this.findRfpOrThrow(tenantId, id);
        const updated = await this.prisma.rfp.update({
            where: { id },
            data: {
                ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
                ...(dto.clientName !== undefined
                    ? { clientName: dto.clientName.trim() }
                    : {}),
                ...(dto.companyName !== undefined
                    ? { companyName: dto.companyName?.trim() || null }
                    : {}),
                ...(dto.industry !== undefined
                    ? { industry: dto.industry?.trim() || null }
                    : {}),
                ...(dto.projectName !== undefined
                    ? { projectName: dto.projectName?.trim() || null }
                    : {}),
                ...(dto.dueDate !== undefined
                    ? { dueDate: this.parseOptionalDate(dto.dueDate, 'dueDate') }
                    : {}),
                ...(dto.startDate !== undefined
                    ? { startDate: this.parseOptionalDate(dto.startDate, 'startDate') }
                    : {}),
                ...(dto.endDate !== undefined
                    ? { endDate: this.parseOptionalDate(dto.endDate, 'endDate') }
                    : {}),
                ...(dto.estimatedBudget !== undefined
                    ? { estimatedBudget: dto.estimatedBudget }
                    : {}),
                ...(dto.securityTypes !== undefined
                    ? { securityTypes: this.normalizeSecurityTypes(dto.securityTypes) }
                    : {}),
                ...(dto.numberOfLocations !== undefined
                    ? { numberOfLocations: dto.numberOfLocations }
                    : {}),
                ...(dto.address !== undefined
                    ? { address: dto.address?.trim() || null }
                    : {}),
                ...(dto.operatingHours !== undefined
                    ? { operatingHours: dto.operatingHours?.trim() || null }
                    : {}),
                ...(dto.guardsRequired !== undefined
                    ? { guardsRequired: dto.guardsRequired }
                    : {}),
                ...(dto.additionalRequirements !== undefined
                    ? {
                        additionalRequirements: dto.additionalRequirements?.trim() || null,
                    }
                    : {}),
                ...(dto.generatedContent !== undefined
                    ? { generatedContent: dto.generatedContent }
                    : {}),
                ...(dto.status !== undefined ? { status: dto.status } : {}),
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'UPDATE',
            entityType: 'Rfp',
            entityId: id,
            details: `Updated RFP: ${updated.title}`,
        });
        return updated;
    }
    async remove(tenantId, userId, id) {
        const existing = await this.findRfpOrThrow(tenantId, id);
        await this.prisma.rfp.delete({ where: { id } });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'DELETE',
            entityType: 'Rfp',
            entityId: id,
            details: `Deleted RFP: ${existing.title}`,
        });
        return { success: true };
    }
    async generate(dto) {
        const content = await this.aiService.generateRfp(dto);
        return { content };
    }
    stripInlineTags(html) {
        return html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/(p|div)>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .trim();
    }
    renderContentToPdf(doc, html) {
        if (!html?.trim()) {
            doc
                .fontSize(11)
                .fillColor('#6b7280')
                .text('No content has been generated for this RFP yet.');
            return;
        }
        const blockPattern = /<(h1|h2|h3|p|ul|ol)([^>]*)>([\s\S]*?)<\/\1>/gi;
        const listItemPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
        let match;
        let matchedAny = false;
        while ((match = blockPattern.exec(html)) !== null) {
            matchedAny = true;
            const [, tag, , inner] = match;
            if (tag === 'h1') {
                doc
                    .moveDown(0.5)
                    .fontSize(18)
                    .fillColor('#111827')
                    .font('Helvetica-Bold')
                    .text(this.stripInlineTags(inner));
            }
            else if (tag === 'h2') {
                doc
                    .moveDown(0.5)
                    .fontSize(15)
                    .fillColor('#111827')
                    .font('Helvetica-Bold')
                    .text(this.stripInlineTags(inner));
            }
            else if (tag === 'h3') {
                doc
                    .moveDown(0.4)
                    .fontSize(13)
                    .fillColor('#111827')
                    .font('Helvetica-Bold')
                    .text(this.stripInlineTags(inner));
            }
            else if (tag === 'ul' || tag === 'ol') {
                doc.moveDown(0.2);
                let itemMatch;
                let index = 1;
                listItemPattern.lastIndex = 0;
                while ((itemMatch = listItemPattern.exec(inner)) !== null) {
                    const prefix = tag === 'ol' ? `${index}.` : '•';
                    doc
                        .fontSize(11)
                        .font('Helvetica')
                        .fillColor('#1f2937')
                        .text(`${prefix}  ${this.stripInlineTags(itemMatch[1])}`, {
                        indent: 12,
                    });
                    index += 1;
                }
                doc.moveDown(0.2);
            }
            else {
                const text = this.stripInlineTags(inner);
                if (text) {
                    doc
                        .moveDown(0.3)
                        .fontSize(11)
                        .font('Helvetica')
                        .fillColor('#1f2937')
                        .text(text, {
                        align: 'left',
                        lineGap: 3,
                    });
                }
            }
        }
        if (!matchedAny) {
            doc
                .fontSize(11)
                .font('Helvetica')
                .fillColor('#1f2937')
                .text(this.stripInlineTags(html), {
                align: 'left',
                lineGap: 3,
            });
        }
    }
    async exportPdf(tenantId, id) {
        const rfp = await this.findRfpOrThrow(tenantId, id);
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];
        const branding = await this.brandingService.brandingSnapshot(tenantId);
        return new Promise((resolve, reject) => {
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
            this.brandingService.addPdfHeader(doc, rfp.title, branding);
            doc.moveDown();
            doc
                .fontSize(10)
                .fillColor(branding.secondary_color)
                .text(`Client: ${rfp.clientName}${rfp.companyName ? ` (${rfp.companyName})` : ''} | Status: ${rfp.status}`, { align: 'left' });
            doc.moveDown(0.5);
            doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
            doc.moveDown();
            this.renderContentToPdf(doc, rfp.generatedContent);
            doc.end();
        });
    }
    async findAssignedVendors(tenantId, id) {
        await this.findRfpOrThrow(tenantId, id);
        const assignments = await this.prisma.rfpVendor.findMany({
            where: { tenantId, rfpId: id },
            include: { vendor: true },
            orderBy: { createdAt: 'desc' },
        });
        return assignments.map((assignment) => assignment.vendor);
    }
    async assignVendors(tenantId, userId, id, vendorIds) {
        await this.findRfpOrThrow(tenantId, id);
        const uniqueVendorIds = Array.from(new Set(vendorIds.map((vendorId) => vendorId.trim()).filter(Boolean)));
        const vendors = await this.prisma.vendor.findMany({
            where: { id: { in: uniqueVendorIds }, tenantId },
            select: { id: true, companyName: true },
        });
        if (vendors.length !== uniqueVendorIds.length) {
            throw new common_1.BadRequestException('One or more vendors were not found in this tenant');
        }
        await this.prisma.rfpVendor.createMany({
            data: vendors.map((vendor) => ({
                tenantId,
                rfpId: id,
                vendorId: vendor.id,
            })),
            skipDuplicates: true,
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'UPDATE',
            entityType: 'Rfp',
            entityId: id,
            details: `Assigned vendor(s) to RFP: ${vendors.map((vendor) => vendor.companyName).join(', ')}`,
        });
        return this.findAssignedVendors(tenantId, id);
    }
    async removeVendor(tenantId, userId, id, vendorId) {
        await this.findRfpOrThrow(tenantId, id);
        const assignment = await this.prisma.rfpVendor.findFirst({
            where: { tenantId, rfpId: id, vendorId },
            include: { vendor: true },
        });
        if (!assignment) {
            throw new common_1.NotFoundException('This vendor is not assigned to this RFP');
        }
        await this.prisma.rfpVendor.delete({ where: { id: assignment.id } });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'UPDATE',
            entityType: 'Rfp',
            entityId: id,
            details: `Removed vendor from RFP: ${assignment.vendor.companyName}`,
        });
        return { success: true };
    }
};
exports.RfpService = RfpService;
exports.RfpService = RfpService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_service_1.AiService,
        audit_service_1.AuditService,
        branding_service_1.BrandingService])
], RfpService);
//# sourceMappingURL=rfp.service.js.map