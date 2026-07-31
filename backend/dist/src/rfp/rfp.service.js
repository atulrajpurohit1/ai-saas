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
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
const audit_service_1 = require("../audit/audit.service");
const branding_service_1 = require("../branding/branding.service");
const email_service_1 = require("../email/email.service");
const file_storage_util_1 = require("../common/file-storage.util");
const SUBMISSION_DOCUMENT_LABELS = {
    proposalFile: 'Proposal PDF',
    pricingFile: 'Pricing Sheet',
    insuranceFile: 'Insurance Certificate',
    licenseFile: 'Security License',
};
const EVALUATION_EXCERPT_MAX_CHARS = 3000;
const SUBMISSION_FILE_FIELDS = [
    'proposalFile',
    'pricingFile',
    'insuranceFile',
    'licenseFile',
];
let RfpService = class RfpService {
    prisma;
    aiService;
    auditService;
    brandingService;
    emailService;
    constructor(prisma, aiService, auditService, brandingService, emailService) {
        this.prisma = prisma;
        this.aiService = aiService;
        this.auditService = auditService;
        this.brandingService = brandingService;
        this.emailService = emailService;
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
    normalizePricingItems(value) {
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
                pricingModel: dto.pricingModel ?? null,
                requiredPricingItems: this.normalizePricingItems(dto.requiredPricingItems),
                paymentTerms: dto.paymentTerms?.trim() || null,
                pricingValidity: dto.pricingValidity?.trim() || null,
                pricingNotes: dto.pricingNotes?.trim() || null,
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
        const evaluation = await this.findLatestEvaluation(tenantId, id);
        const awardedVendor = rfp.awardedVendorId
            ? await this.prisma.vendor.findFirst({
                where: { id: rfp.awardedVendorId, tenantId },
                select: {
                    id: true,
                    companyName: true,
                    contactPerson: true,
                    email: true,
                },
            })
            : null;
        return { ...withCreator, evaluation, awardedVendor };
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
                ...(dto.pricingModel !== undefined
                    ? { pricingModel: dto.pricingModel ?? null }
                    : {}),
                ...(dto.requiredPricingItems !== undefined
                    ? {
                        requiredPricingItems: this.normalizePricingItems(dto.requiredPricingItems),
                    }
                    : {}),
                ...(dto.paymentTerms !== undefined
                    ? { paymentTerms: dto.paymentTerms?.trim() || null }
                    : {}),
                ...(dto.pricingValidity !== undefined
                    ? { pricingValidity: dto.pricingValidity?.trim() || null }
                    : {}),
                ...(dto.pricingNotes !== undefined
                    ? { pricingNotes: dto.pricingNotes?.trim() || null }
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
        const rfp = await this.findRfpOrThrow(tenantId, id);
        if (rfp.awardedVendorId === vendorId) {
            throw new common_1.BadRequestException('The awarded vendor cannot be removed from this RFP.');
        }
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
    async inviteVendors(tenantId, userId, id, vendorIds) {
        const rfp = await this.findRfpOrThrow(tenantId, id);
        const uniqueVendorIds = Array.from(new Set(vendorIds.map((vendorId) => vendorId.trim()).filter(Boolean)));
        const vendors = await this.prisma.vendor.findMany({
            where: { id: { in: uniqueVendorIds }, tenantId },
        });
        if (vendors.length !== uniqueVendorIds.length) {
            throw new common_1.BadRequestException('One or more vendors were not found in this tenant');
        }
        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
        const invited = [];
        const skippedNoEmail = [];
        const emailFailed = [];
        for (const vendor of vendors) {
            if (!vendor.email) {
                skippedNoEmail.push(vendor.companyName);
                continue;
            }
            const invitationToken = (0, crypto_1.randomBytes)(32).toString('base64url');
            const rfpVendor = await this.prisma.rfpVendor.upsert({
                where: { rfpId_vendorId: { rfpId: id, vendorId: vendor.id } },
                update: {
                    invitationToken,
                    invitationStatus: 'INVITED',
                    invitedAt: new Date(),
                },
                create: {
                    tenantId,
                    rfpId: id,
                    vendorId: vendor.id,
                    invitationToken,
                    invitationStatus: 'INVITED',
                    invitedAt: new Date(),
                },
            });
            invited.push(vendor.companyName);
            try {
                await this.emailService.sendVendorInvitationEmail(tenantId, {
                    vendorEmail: vendor.email,
                    vendorCompanyName: vendor.companyName,
                    rfpTitle: rfp.title,
                    dueDate: rfp.dueDate,
                    invitationUrl: `${frontendUrl}/vendor/invitation/${rfpVendor.invitationToken}`,
                });
            }
            catch (error) {
                emailFailed.push(vendor.companyName);
                console.error(`Failed to send vendor invitation email to ${vendor.email}`, error);
            }
        }
        await this.auditService.log({
            tenantId,
            userId,
            action: 'UPDATE',
            entityType: 'Rfp',
            entityId: id,
            details: `Invited vendor(s) to RFP: ${invited.join(', ') || 'none'}`,
        });
        return { invited, skippedNoEmail, emailFailed };
    }
    async findSubmissions(tenantId, id) {
        await this.findRfpOrThrow(tenantId, id);
        return this.prisma.rfpVendor.findMany({
            where: { tenantId, rfpId: id },
            include: { vendor: true, submission: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async downloadSubmissionFile(tenantId, id, vendorId, field) {
        if (!SUBMISSION_FILE_FIELDS.includes(field)) {
            throw new common_1.BadRequestException('Invalid document field');
        }
        await this.findRfpOrThrow(tenantId, id);
        const rfpVendor = await this.prisma.rfpVendor.findFirst({
            where: { tenantId, rfpId: id, vendorId },
            include: { submission: true },
        });
        if (!rfpVendor?.submission) {
            throw new common_1.NotFoundException('No submission found for this vendor');
        }
        const storedFilename = rfpVendor.submission[field];
        if (!storedFilename) {
            throw new common_1.NotFoundException('This document was not submitted');
        }
        const filePath = (0, path_1.join)(file_storage_util_1.VENDOR_UPLOAD_DIR, storedFilename);
        if (!(0, fs_1.existsSync)(filePath)) {
            throw new common_1.NotFoundException('File not found on server');
        }
        return { stream: (0, fs_1.createReadStream)(filePath), filename: storedFilename };
    }
    async extractPdfExcerpt(storedFilename) {
        if (!storedFilename || !/\.pdf$/i.test(storedFilename))
            return null;
        try {
            const filePath = (0, path_1.join)(file_storage_util_1.VENDOR_UPLOAD_DIR, storedFilename);
            if (!(0, fs_1.existsSync)(filePath))
                return null;
            const buffer = await (0, promises_1.readFile)(filePath);
            const pdfParse = require('pdf-parse');
            const data = await pdfParse(buffer, { pagerender: () => '' });
            const text = String(data.text || '').trim();
            return text ? text.slice(0, EVALUATION_EXCERPT_MAX_CHARS) : null;
        }
        catch {
            return null;
        }
    }
    async generateEvaluation(tenantId, userId, id) {
        const rfp = await this.findRfpOrThrow(tenantId, id);
        const rfpVendors = await this.prisma.rfpVendor.findMany({
            where: { tenantId, rfpId: id },
            include: { vendor: true, submission: true },
        });
        const submitted = rfpVendors.filter((item) => item.submission);
        if (submitted.length === 0) {
            throw new common_1.BadRequestException('At least one vendor must have a submitted proposal before an evaluation can be generated.');
        }
        const vendorSummaries = await Promise.all(submitted.map(async (item) => {
            const submission = item.submission;
            const submittedDocuments = [];
            const missingDocuments = [];
            for (const field of SUBMISSION_FILE_FIELDS) {
                const label = SUBMISSION_DOCUMENT_LABELS[field];
                if (submission[field]) {
                    submittedDocuments.push(label);
                }
                else {
                    missingDocuments.push(label);
                }
            }
            const [proposalExcerpt, pricingExcerpt] = await Promise.all([
                this.extractPdfExcerpt(submission.proposalFile),
                this.extractPdfExcerpt(submission.pricingFile),
            ]);
            return {
                companyName: item.vendor.companyName,
                contactPerson: item.vendor.contactPerson,
                servicesOffered: Array.isArray(item.vendor.services)
                    ? item.vendor.services
                    : [],
                submittedDocuments,
                missingDocuments,
                notes: submission.notes,
                proposalExcerpt,
                pricingExcerpt,
                submittedAt: item.submittedAt ? item.submittedAt.toISOString() : null,
            };
        }));
        const evaluationDto = {
            rfpTitle: rfp.title,
            clientName: rfp.clientName,
            industry: rfp.industry,
            securityTypes: Array.isArray(rfp.securityTypes)
                ? rfp.securityTypes
                : [],
            numberOfLocations: rfp.numberOfLocations,
            guardsRequired: rfp.guardsRequired,
            estimatedBudget: rfp.estimatedBudget,
            additionalRequirements: rfp.additionalRequirements,
            vendors: vendorSummaries,
        };
        const result = await this.aiService.generateEvaluationReport(evaluationDto);
        const evaluation = await this.prisma.evaluationReport.create({
            data: {
                tenantId,
                rfpId: id,
                summary: result.summary,
                recommendedVendor: result.recommendedVendor,
                overallAnalysis: result.overallAnalysis,
                generatedReport: result.fullReportMarkdown,
            },
        });
        if (rfp.status !== 'AWARDED') {
            await this.prisma.rfp.update({
                where: { id },
                data: { status: 'EVALUATED' },
            });
        }
        await this.auditService.log({
            tenantId,
            userId,
            action: 'GENERATE',
            entityType: 'EvaluationReport',
            entityId: evaluation.id,
            details: `Generated AI Evaluation for RFP: ${rfp.title}`,
        });
        return evaluation;
    }
    async findLatestEvaluation(tenantId, id) {
        return this.prisma.evaluationReport.findFirst({
            where: { tenantId, rfpId: id },
            orderBy: { createdAt: 'desc' },
        });
    }
    getRejectedVendorIds(rfp) {
        return Array.isArray(rfp.rejectedVendorIds)
            ? rfp.rejectedVendorIds
            : [];
    }
    async awardContract(tenantId, userId, id, vendorId, awardNotes) {
        const rfp = await this.findRfpOrThrow(tenantId, id);
        if (rfp.awardedVendorId) {
            throw new common_1.BadRequestException('This RFP has already been awarded.');
        }
        const evaluation = await this.findLatestEvaluation(tenantId, id);
        if (!evaluation) {
            throw new common_1.BadRequestException('An AI evaluation must be generated before a contract can be awarded.');
        }
        if (this.getRejectedVendorIds(rfp).includes(vendorId)) {
            throw new common_1.BadRequestException('This vendor has already been rejected and cannot be awarded the contract.');
        }
        const rfpVendor = await this.prisma.rfpVendor.findFirst({
            where: { tenantId, rfpId: id, vendorId },
            include: { vendor: true, submission: true },
        });
        if (!rfpVendor) {
            throw new common_1.NotFoundException('This vendor is not assigned to this RFP.');
        }
        if (!rfpVendor.submission) {
            throw new common_1.BadRequestException('This vendor has not submitted a proposal and cannot be awarded the contract.');
        }
        const awardResult = await this.prisma.rfp.updateMany({
            where: { id, tenantId, awardedVendorId: null },
            data: {
                awardedVendorId: vendorId,
                awardDate: new Date(),
                awardNotes: awardNotes?.trim() || null,
                status: 'AWARDED',
            },
        });
        if (awardResult.count === 0) {
            throw new common_1.BadRequestException('This RFP has already been awarded.');
        }
        const updated = await this.findRfpOrThrow(tenantId, id);
        if (rfpVendor.vendor.email) {
            try {
                await this.emailService.sendContractAwardEmail(tenantId, {
                    vendorEmail: rfpVendor.vendor.email,
                    vendorCompanyName: rfpVendor.vendor.companyName,
                    rfpTitle: rfp.title,
                    awardNotes: updated.awardNotes,
                });
            }
            catch (error) {
                console.error(`Failed to send contract award email to ${rfpVendor.vendor.email}`, error);
            }
        }
        await this.auditService.log({
            tenantId,
            userId,
            action: 'CONTRACT_AWARDED',
            entityType: 'Rfp',
            entityId: id,
            details: `Contract Awarded to vendor: ${rfpVendor.vendor.companyName}`,
        });
        return updated;
    }
    async rejectVendor(tenantId, userId, id, vendorId, reason) {
        const rfp = await this.findRfpOrThrow(tenantId, id);
        if (rfp.awardedVendorId === vendorId) {
            throw new common_1.BadRequestException('This vendor has already been awarded the contract and cannot be rejected.');
        }
        const rfpVendor = await this.prisma.rfpVendor.findFirst({
            where: { tenantId, rfpId: id, vendorId },
            include: { vendor: true },
        });
        if (!rfpVendor) {
            throw new common_1.NotFoundException('This vendor is not assigned to this RFP.');
        }
        const rejectedVendorIds = this.getRejectedVendorIds(rfp);
        if (!rejectedVendorIds.includes(vendorId)) {
            rejectedVendorIds.push(vendorId);
            await this.prisma.rfp.update({
                where: { id },
                data: { rejectedVendorIds },
            });
        }
        if (rfpVendor.vendor.email) {
            try {
                await this.emailService.sendVendorRejectionEmail(tenantId, {
                    vendorEmail: rfpVendor.vendor.email,
                    vendorCompanyName: rfpVendor.vendor.companyName,
                    rfpTitle: rfp.title,
                    reason,
                });
            }
            catch (error) {
                console.error(`Failed to send vendor rejection email to ${rfpVendor.vendor.email}`, error);
            }
        }
        await this.auditService.log({
            tenantId,
            userId,
            action: 'VENDOR_REJECTED',
            entityType: 'Rfp',
            entityId: id,
            details: `Vendor Rejected: ${rfpVendor.vendor.companyName}${reason ? ` (${reason})` : ''}`,
        });
        return { success: true, rejectedVendorIds };
    }
    async findPerformanceReviews(tenantId, id) {
        await this.findRfpOrThrow(tenantId, id);
        return this.prisma.vendorPerformance.findMany({
            where: { tenantId, rfpId: id },
            orderBy: { reviewDate: 'desc' },
        });
    }
    async createPerformanceReview(tenantId, userId, id, dto) {
        const rfp = await this.findRfpOrThrow(tenantId, id);
        if (rfp.status !== 'AWARDED' || !rfp.awardedVendorId) {
            throw new common_1.BadRequestException('A performance review can only be added once this RFP has an awarded vendor.');
        }
        const review = await this.prisma.vendorPerformance.create({
            data: {
                tenantId,
                rfpId: id,
                vendorId: rfp.awardedVendorId,
                reviewDate: this.parseOptionalDate(dto.reviewDate, 'reviewDate') ?? new Date(),
                overallRating: dto.overallRating,
                slaCompliance: dto.slaCompliance,
                incidentCount: dto.incidentCount,
                responseTime: dto.responseTime,
                notes: dto.notes?.trim() || null,
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'PERFORMANCE_REVIEW_ADDED',
            entityType: 'VendorPerformance',
            entityId: review.id,
            details: `Performance Review Added for RFP: ${rfp.title}`,
        });
        return review;
    }
    async updatePerformanceReview(tenantId, userId, reviewId, dto) {
        const existing = await this.prisma.vendorPerformance.findFirst({
            where: { id: reviewId, tenantId },
            include: { rfp: { select: { title: true } } },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Performance review not found');
        }
        const updated = await this.prisma.vendorPerformance.update({
            where: { id: reviewId },
            data: {
                ...(dto.reviewDate !== undefined
                    ? {
                        reviewDate: this.parseOptionalDate(dto.reviewDate, 'reviewDate') ??
                            existing.reviewDate,
                    }
                    : {}),
                ...(dto.overallRating !== undefined
                    ? { overallRating: dto.overallRating }
                    : {}),
                ...(dto.slaCompliance !== undefined
                    ? { slaCompliance: dto.slaCompliance }
                    : {}),
                ...(dto.incidentCount !== undefined
                    ? { incidentCount: dto.incidentCount }
                    : {}),
                ...(dto.responseTime !== undefined
                    ? { responseTime: dto.responseTime }
                    : {}),
                ...(dto.notes !== undefined
                    ? { notes: dto.notes?.trim() || null }
                    : {}),
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'PERFORMANCE_REVIEW_UPDATED',
            entityType: 'VendorPerformance',
            entityId: reviewId,
            details: `Performance Review Updated for RFP: ${existing.rfp.title}`,
        });
        return updated;
    }
};
exports.RfpService = RfpService;
exports.RfpService = RfpService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_service_1.AiService,
        audit_service_1.AuditService,
        branding_service_1.BrandingService,
        email_service_1.EmailService])
], RfpService);
//# sourceMappingURL=rfp.service.js.map