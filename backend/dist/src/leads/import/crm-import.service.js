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
exports.CrmImportService = void 0;
const common_1 = require("@nestjs/common");
const csv_parser_1 = __importDefault(require("csv-parser"));
const stream_1 = require("stream");
const audit_service_1 = require("../../audit/audit.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const column_matcher_1 = require("./column-matcher");
const crm_import_types_1 = require("./crm-import.types");
const PREVIEW_ROWS = 10;
const MAX_ROWS = 50_000;
let CrmImportService = class CrmImportService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async preview(buffer) {
        const { headers, rows } = await this.parseCsv(buffer);
        if (headers.length === 0) {
            throw new common_1.BadRequestException('That file has no readable header row. Export it from your CRM as CSV and try again.');
        }
        return {
            headers,
            rows: rows.slice(0, PREVIEW_ROWS),
            totalRows: rows.length,
            suggestedMapping: (0, column_matcher_1.suggestMapping)(headers),
            detectedCrm: (0, column_matcher_1.detectCrm)(headers),
        };
    }
    async commit(buffer, mapping, tenantId, userId, sourceLabel) {
        const { headers, rows } = await this.parseCsv(buffer);
        this.assertMappingIsUsable(mapping, headers);
        const nameParts = mapping.name ? null : (0, column_matcher_1.findNameParts)(headers);
        const result = {
            created: 0,
            updated: 0,
            skipped: 0,
            totalRows: rows.length,
            errors: [],
        };
        for (const [index, row] of rows.entries()) {
            const line = index + 2;
            const name = this.resolveName(row, mapping, nameParts);
            const company = this.value(row, mapping.company);
            const email = this.value(row, mapping.email);
            const status = this.value(row, mapping.status)?.toLowerCase() || 'new';
            if (!name || !company) {
                result.skipped += 1;
                if (result.errors.length < 50) {
                    result.errors.push({
                        row: line,
                        reason: !name ? 'Missing a name' : 'Missing a company',
                    });
                }
                continue;
            }
            const existing = await this.prisma.lead.findFirst({
                where: {
                    tenantId,
                    ...(email ? { email } : { name, company }),
                },
            });
            if (existing) {
                await this.prisma.lead.update({
                    where: { id: existing.id },
                    data: { name, company, status, ...(email ? { email } : {}) },
                });
                result.updated += 1;
            }
            else {
                await this.prisma.lead.create({
                    data: { tenantId, name, company, email, status },
                });
                result.created += 1;
            }
        }
        await this.auditService.log({
            tenantId,
            userId,
            action: 'LEADS_IMPORTED',
            entityType: 'Lead',
            details: `Imported leads from ${sourceLabel || 'a CRM export'}: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
        });
        return result;
    }
    resolveName(row, mapping, nameParts) {
        if (mapping.name)
            return this.value(row, mapping.name);
        if (!nameParts)
            return null;
        return ([this.value(row, nameParts.first), this.value(row, nameParts.last)]
            .filter(Boolean)
            .join(' ') || null);
    }
    value(row, header) {
        if (!header)
            return null;
        const raw = row[header];
        return typeof raw === 'string' ? raw.trim() || null : null;
    }
    assertMappingIsUsable(mapping, headers) {
        const unknownFields = Object.keys(mapping).filter((field) => !crm_import_types_1.IMPORTABLE_FIELDS.includes(field));
        if (unknownFields.length > 0) {
            throw new common_1.BadRequestException(`Cannot import into unknown lead fields: ${unknownFields.join(', ')}`);
        }
        const missingColumns = Object.entries(mapping)
            .filter(([, header]) => header && !headers.includes(header))
            .map(([field, header]) => `${field} -> "${header}"`);
        if (missingColumns.length > 0) {
            throw new common_1.BadRequestException(`The uploaded file has no column for: ${missingColumns.join(', ')}`);
        }
        const hasName = Boolean(mapping.name) || Boolean((0, column_matcher_1.findNameParts)(headers));
        const missing = crm_import_types_1.REQUIRED_FIELDS.filter((field) => field === 'name' ? !hasName : !mapping[field]);
        if (missing.length > 0) {
            throw new common_1.BadRequestException(`Map a column to each required field before importing: ${missing.join(', ')}`);
        }
    }
    parseCsv(buffer) {
        return new Promise((resolve, reject) => {
            const rows = [];
            let headers = [];
            stream_1.Readable.from(buffer)
                .pipe((0, csv_parser_1.default)({
                mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim() || null,
            }))
                .on('headers', (parsed) => {
                headers = this.dedupeHeaders(parsed);
            })
                .on('data', (row) => {
                if (rows.length >= MAX_ROWS)
                    return;
                if (Object.values(row).some((value) => value?.trim()))
                    rows.push(row);
            })
                .on('end', () => resolve({ headers, rows }))
                .on('error', () => reject(new common_1.BadRequestException('That file could not be read as CSV. Export it from your CRM as CSV and try again.')));
        });
    }
    dedupeHeaders(headers) {
        const seen = new Set();
        return headers.filter((header) => {
            const key = (0, column_matcher_1.normalizeHeader)(header);
            if (!header || seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
};
exports.CrmImportService = CrmImportService;
exports.CrmImportService = CrmImportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], CrmImportService);
//# sourceMappingURL=crm-import.service.js.map