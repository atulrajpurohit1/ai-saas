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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesImportsService = void 0;
const common_1 = require("@nestjs/common");
const csv_parser_1 = __importDefault(require("csv-parser"));
const stream_1 = require("stream");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
const FIELD_ALIASES = {
    name: ['name', 'contact name', 'full name', 'primary contact', 'contact', 'lead name'],
    company: ['company', 'company name', 'account', 'account name', 'business', 'organization', 'property'],
    email: ['email', 'email address', 'contact email', 'lead email'],
    status: ['status', 'lead status', 'crm status'],
    dealName: ['deal name', 'opportunity', 'opportunity name', 'project', 'pipeline deal'],
    stage: ['stage', 'deal stage', 'pipeline stage', 'opportunity stage'],
    propertyType: ['property type', 'site type', 'segment', 'industry', 'vertical'],
    buyerRole: ['buyer role', 'role', 'title', 'decision maker role', 'contact title'],
    currentProvider: ['current provider', 'incumbent', 'existing provider', 'security provider'],
    guardCount: ['guard count', 'guards', 'number of guards', 'posts', 'post count'],
    serviceHours: ['service hours', 'coverage hours', 'shift hours', 'coverage', 'schedule'],
    painPoints: ['pain points', 'pain', 'problems', 'current issues', 'challenges'],
    riskConcerns: ['risk concerns', 'risks', 'security risks', 'incidents', 'risk drivers'],
    decisionTimeline: ['decision timeline', 'timeline', 'start date', 'decision date', 'urgency'],
    budgetSensitivity: ['budget sensitivity', 'budget', 'price sensitivity', 'pricing concern'],
    objections: ['objections', 'concerns', 'sales objections', 'buyer concerns'],
    notes: ['notes', 'comments', 'description', 'summary', 'call notes'],
};
const IMPORT_FIELDS = Object.keys(FIELD_ALIASES);
let SalesImportsService = class SalesImportsService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async preview(buffer) {
        const parsed = await this.parseCsv(buffer, 500);
        const detectedMapping = this.detectMapping(parsed.headers);
        return {
            headers: parsed.headers,
            sampleRows: parsed.rows.slice(0, 8),
            previewRows: parsed.rows.length,
            totalRows: parsed.totalRows,
            detectedMapping,
            requiredFields: {
                leads: ['name', 'company'],
                deals: ['name', 'company', 'dealName'],
            },
        };
    }
    async commit(buffer, body, tenantId, userId) {
        const target = this.normalizeTarget(body.target);
        const mapping = this.normalizeMapping(body.mapping);
        const parsed = await this.parseCsv(buffer, 5000);
        this.validateMapping(target, mapping);
        const summary = {
            target,
            totalRows: parsed.totalRows,
            processedRows: 0,
            skippedRows: Math.max(0, parsed.totalRows - parsed.rows.length),
            leadsCreated: 0,
            leadsUpdated: 0,
            leadsMatched: 0,
            dealsCreated: 0,
            dealsUpdated: 0,
            dealsMatched: 0,
            discoverySessionsCreated: 0,
            errors: [],
        };
        for (const [index, row] of parsed.rows.entries()) {
            try {
                const leadSync = await this.syncLead(row, mapping, tenantId);
                summary.leadsCreated += leadSync.created ? 1 : 0;
                summary.leadsUpdated += leadSync.updated ? 1 : 0;
                summary.leadsMatched += !leadSync.created ? 1 : 0;
                let dealId;
                if (target === 'deals') {
                    const dealSync = await this.syncDeal(row, mapping, tenantId, leadSync.lead.id);
                    dealId = dealSync.deal.id;
                    summary.dealsCreated += dealSync.created ? 1 : 0;
                    summary.dealsUpdated += dealSync.updated ? 1 : 0;
                    summary.dealsMatched += !dealSync.created ? 1 : 0;
                }
                if (await this.createDiscoverySession(row, mapping, tenantId, leadSync.lead.id, dealId, userId)) {
                    summary.discoverySessionsCreated += 1;
                }
                summary.processedRows += 1;
            }
            catch (error) {
                summary.errors.push({
                    row: index + 2,
                    message: error instanceof Error ? error.message : 'Unable to import row',
                });
            }
        }
        await this.auditService.log({
            tenantId,
            userId,
            action: 'IMPORT',
            entityType: 'SALES_IMPORT',
            details: `Imported ${summary.processedRows} ${target} rows from CSV`,
        });
        return summary;
    }
    async syncLead(row, mapping, tenantId) {
        const name = this.text(row, mapping.name);
        const company = this.text(row, mapping.company);
        const email = this.text(row, mapping.email);
        const status = this.text(row, mapping.status) || 'new';
        if (!name)
            throw new common_1.BadRequestException('Contact name is required');
        if (!company)
            throw new common_1.BadRequestException('Company is required');
        const orFilters = email
            ? [{ email }, { company, name }]
            : [{ company, name }];
        const existing = await this.prisma.lead.findFirst({
            where: { tenantId, OR: orFilters },
        });
        if (!existing) {
            const lead = await this.prisma.lead.create({
                data: {
                    name,
                    company,
                    email,
                    status,
                    tenantId,
                },
            });
            return { lead, created: true, updated: false };
        }
        const data = {};
        if (email && existing.email !== email)
            data.email = email;
        if (status && existing.status !== status)
            data.status = status;
        if (Object.keys(data).length === 0) {
            return { lead: existing, created: false, updated: false };
        }
        const lead = await this.prisma.lead.update({
            where: { id: existing.id },
            data,
        });
        return { lead, created: false, updated: true };
    }
    async syncDeal(row, mapping, tenantId, leadId) {
        const company = this.text(row, mapping.company) || 'Imported account';
        const name = this.text(row, mapping.dealName) || `Deal for ${company}`;
        const stage = this.normalizeStage(this.text(row, mapping.stage));
        const existing = await this.prisma.deal.findFirst({
            where: { tenantId, leadId, name },
        });
        if (!existing) {
            const deal = await this.prisma.deal.create({
                data: {
                    name,
                    stage,
                    tenantId,
                    leadId,
                },
            });
            return { deal, created: true, updated: false };
        }
        if (existing.stage === stage) {
            return { deal: existing, created: false, updated: false };
        }
        const deal = await this.prisma.deal.update({
            where: { id: existing.id },
            data: { stage },
        });
        return { deal, created: false, updated: true };
    }
    async createDiscoverySession(row, mapping, tenantId, leadId, dealId, userId) {
        const discovery = {
            propertyType: this.text(row, mapping.propertyType),
            buyerRole: this.text(row, mapping.buyerRole),
            currentProvider: this.text(row, mapping.currentProvider),
            guardCount: this.number(row, mapping.guardCount),
            serviceHours: this.text(row, mapping.serviceHours),
            painPoints: this.list(row, mapping.painPoints),
            riskConcerns: this.list(row, mapping.riskConcerns),
            decisionTimeline: this.text(row, mapping.decisionTimeline),
            budgetSensitivity: this.text(row, mapping.budgetSensitivity),
            objections: this.list(row, mapping.objections),
            notes: this.text(row, mapping.notes),
        };
        const hasDiscoveryData = Object.values(discovery).some((value) => Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined);
        if (!hasDiscoveryData)
            return false;
        await this.prisma.discoverySession.create({
            data: {
                ...discovery,
                tenantId,
                leadId,
                dealId,
                createdBy: userId,
            },
        });
        return true;
    }
    parseCsv(buffer, maxRows) {
        const rows = [];
        let headers = [];
        let totalRows = 0;
        return new Promise((resolve, reject) => {
            stream_1.Readable.from(buffer)
                .pipe((0, csv_parser_1.default)())
                .on('headers', (csvHeaders) => {
                headers = csvHeaders.map((header) => header.trim()).filter(Boolean);
            })
                .on('data', (row) => {
                totalRows += 1;
                if (rows.length < maxRows)
                    rows.push(row);
            })
                .on('end', () => {
                if (headers.length === 0) {
                    reject(new common_1.BadRequestException('CSV file must include a header row'));
                    return;
                }
                resolve({ headers, rows, totalRows });
            })
                .on('error', (error) => reject(error));
        });
    }
    detectMapping(headers) {
        const normalizedHeaders = new Map(headers.map((header) => [this.normalizeHeader(header), header]));
        const detected = {};
        for (const field of IMPORT_FIELDS) {
            const match = FIELD_ALIASES[field]
                .map((alias) => this.normalizeHeader(alias))
                .find((alias) => normalizedHeaders.has(alias));
            if (match)
                detected[field] = normalizedHeaders.get(match);
        }
        return detected;
    }
    normalizeMapping(input) {
        if (!input)
            throw new common_1.BadRequestException('Column mapping is required');
        const parsed = typeof input === 'string' ? JSON.parse(input) : input;
        const mapping = {};
        for (const field of IMPORT_FIELDS) {
            const value = parsed[field];
            if (typeof value === 'string' && value.trim()) {
                mapping[field] = value.trim();
            }
        }
        return mapping;
    }
    validateMapping(target, mapping) {
        if (!mapping.name)
            throw new common_1.BadRequestException('Map the contact name column before import');
        if (!mapping.company)
            throw new common_1.BadRequestException('Map the company column before import');
        if (target === 'deals' && !mapping.dealName) {
            throw new common_1.BadRequestException('Map the deal name column before importing deals');
        }
    }
    normalizeTarget(target) {
        if (target === 'leads' || target === 'deals')
            return target;
        throw new common_1.BadRequestException('Import target must be leads or deals');
    }
    normalizeStage(value) {
        const normalized = (value || '').trim().toLowerCase();
        if (['contacted', 'qualified'].includes(normalized))
            return 'Contacted';
        if (['proposal', 'proposal sent', 'quoted', 'quote sent'].includes(normalized))
            return 'Proposal';
        if (['won', 'closed won', 'closed'].includes(normalized))
            return 'Won';
        if (['lost', 'closed lost'].includes(normalized))
            return 'Lost';
        return normalized ? value.trim() : 'New';
    }
    text(row, header) {
        if (!header)
            return null;
        const value = row[header];
        const trimmed = typeof value === 'string' ? value.trim() : '';
        return trimmed || null;
    }
    number(row, header) {
        const value = this.text(row, header);
        if (!value)
            return null;
        const numeric = Number.parseInt(value.replace(/[^0-9-]/g, ''), 10);
        return Number.isFinite(numeric) ? numeric : null;
    }
    list(row, header) {
        const value = this.text(row, header);
        if (!value)
            return [];
        return Array.from(new Set(value
            .split(/[\n;,|]+/)
            .map((item) => item.trim())
            .filter(Boolean))).slice(0, 12);
    }
    normalizeHeader(value) {
        return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
    }
};
exports.SalesImportsService = SalesImportsService;
exports.SalesImportsService = SalesImportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], SalesImportsService);
//# sourceMappingURL=sales-imports.service.js.map