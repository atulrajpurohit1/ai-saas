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
exports.LeadsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const csv_parser_1 = __importDefault(require("csv-parser"));
const fast_csv_1 = require("fast-csv");
const stream_1 = require("stream");
const ai_service_1 = require("../ai/ai.service");
let LeadsService = class LeadsService {
    prisma;
    aiService;
    auditService;
    constructor(prisma, aiService, auditService) {
        this.prisma = prisma;
        this.aiService = aiService;
        this.auditService = auditService;
    }
    async create(createLeadDto, tenantId, userId) {
        const lead = await this.prisma.lead.create({
            data: {
                ...createLeadDto,
                tenantId,
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'CREATE',
            entityType: 'LEAD',
            entityId: lead.id,
            details: `Created lead for ${lead.company}`,
        });
        return lead;
    }
    async findAll(tenantId) {
        return this.prisma.lead.findMany({
            where: { tenantId },
            include: { notes: true, deals: true },
        });
    }
    async findOne(id, tenantId) {
        const lead = await this.prisma.lead.findFirst({
            where: { id, tenantId },
            include: { notes: true, deals: true },
        });
        if (!lead) {
            throw new common_1.NotFoundException(`Lead with ID ${id} not found for this tenant`);
        }
        return lead;
    }
    async update(id, updateLeadDto, tenantId, userId) {
        await this.findOne(id, tenantId);
        const lead = await this.prisma.lead.update({
            where: { id },
            data: updateLeadDto,
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'UPDATE',
            entityType: 'LEAD',
            entityId: id,
        });
        return lead;
    }
    async updateStatus(id, updateLeadStatusDto, tenantId, userId) {
        await this.findOne(id, tenantId);
        const lead = await this.prisma.lead.update({
            where: { id },
            data: { status: updateLeadStatusDto.status },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'UPDATE_STATUS',
            entityType: 'LEAD',
            entityId: id,
            details: `Status changed to ${updateLeadStatusDto.status}`,
        });
        return lead;
    }
    async remove(id, tenantId, userId) {
        await this.findOne(id, tenantId);
        await this.prisma.lead.delete({
            where: { id },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'DELETE',
            entityType: 'LEAD',
            entityId: id,
        });
        return { success: true };
    }
    async importLeads(buffer, tenantId) {
        const results = [];
        const stream = stream_1.Readable.from(buffer);
        return new Promise((resolve, reject) => {
            stream
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => {
                if (data.name && data.company) {
                    results.push({
                        name: data.name,
                        email: data.email || null,
                        company: data.company,
                        status: data.status || 'new',
                        tenantId,
                    });
                }
            })
                .on('end', async () => {
                try {
                    const created = await this.prisma.lead.createMany({
                        data: results,
                        skipDuplicates: true,
                    });
                    resolve({ count: created.count });
                }
                catch (error) {
                    reject(error);
                }
            })
                .on('error', (error) => reject(error));
        });
    }
    async exportLeads(tenantId) {
        const leads = await this.prisma.lead.findMany({
            where: { tenantId },
            select: {
                name: true,
                email: true,
                company: true,
                status: true,
                createdAt: true,
            },
        });
        return new Promise((resolve, reject) => {
            const chunks = [];
            const csvStream = (0, fast_csv_1.format)({ headers: true });
            csvStream.on('data', (chunk) => chunks.push(chunk));
            csvStream.on('end', () => resolve(Buffer.concat(chunks).toString()));
            csvStream.on('error', (err) => reject(err));
            leads.forEach((lead) => csvStream.write(lead));
            csvStream.end();
        });
    }
    async processPdfLead(buffer, tenantId) {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        const extractedText = data.text;
        const leadInfo = await this.aiService.extractLeadFromText(extractedText);
        return this.prisma.lead.create({
            data: {
                name: leadInfo.name,
                company: leadInfo.company,
                email: leadInfo.email || null,
                status: 'new',
                tenantId,
            },
        });
    }
    async analyzePdf(buffer) {
        console.log('PDF: Analysis started, buffer size:', buffer.length);
        try {
            const pdfParse = require('pdf-parse');
            const options = {
                pagerender: () => ''
            };
            const data = await pdfParse(buffer, options);
            console.log('PDF: Text extracted successfully');
            const leadInfo = await this.aiService.extractLeadFromText(data.text);
            console.log('PDF: AI extraction result:', leadInfo);
            return leadInfo;
        }
        catch (error) {
            console.error('PDF: Analysis failed error:', error);
            throw error;
        }
    }
};
exports.LeadsService = LeadsService;
exports.LeadsService = LeadsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_service_1.AiService,
        audit_service_1.AuditService])
], LeadsService);
//# sourceMappingURL=leads.service.js.map