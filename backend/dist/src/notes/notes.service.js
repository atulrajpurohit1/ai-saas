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
exports.NotesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
let NotesService = class NotesService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async attachCreatedBy(notes) {
        if (notes.length === 0)
            return [];
        const noteIds = notes.map((note) => note.id);
        const createLogs = await this.prisma.auditLog.findMany({
            where: {
                entityId: { in: noteIds },
                entityType: 'NOTE',
                action: 'CREATE',
                userId: { not: null },
            },
            orderBy: { createdAt: 'asc' },
            select: {
                entityId: true,
                userId: true,
            },
        });
        const noteCreatorIds = new Map();
        for (const log of createLogs) {
            if (log.entityId && log.userId && !noteCreatorIds.has(log.entityId)) {
                noteCreatorIds.set(log.entityId, log.userId);
            }
        }
        const userIds = [...new Set(noteCreatorIds.values())];
        const users = userIds.length
            ? await this.prisma.user.findMany({
                where: { id: { in: userIds } },
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            })
            : [];
        const usersById = new Map(users.map((user) => [user.id, user]));
        return notes.map((note) => {
            const creatorId = noteCreatorIds.get(note.id);
            const creator = creatorId ? usersById.get(creatorId) : undefined;
            return {
                ...note,
                createdBy: creator
                    ? {
                        id: creator.id,
                        name: creator.name,
                        email: creator.email,
                    }
                    : null,
            };
        });
    }
    async ensureEntityExists(entityId, type, tenantId) {
        const entity = type === 'lead'
            ? await this.prisma.lead.findFirst({
                where: { id: entityId, tenantId },
                select: { id: true },
            })
            : await this.prisma.deal.findFirst({
                where: { id: entityId, tenantId },
                select: { id: true },
            });
        if (!entity) {
            throw new common_1.NotFoundException(`${type === 'lead' ? 'Lead' : 'Deal'} not found in this tenant`);
        }
    }
    async create(data) {
        const content = data.content?.trim();
        const hasLead = Boolean(data.leadId);
        const hasDeal = Boolean(data.dealId);
        if (!content) {
            throw new common_1.BadRequestException('Note content is required');
        }
        if (hasLead === hasDeal) {
            throw new common_1.BadRequestException('Provide exactly one of leadId or dealId');
        }
        if (data.leadId) {
            await this.ensureEntityExists(data.leadId, 'lead', data.tenantId);
        }
        if (data.dealId) {
            await this.ensureEntityExists(data.dealId, 'deal', data.tenantId);
        }
        const note = await this.prisma.note.create({
            data: {
                content,
                leadId: data.leadId,
                dealId: data.dealId,
                tenantId: data.tenantId,
            },
        });
        await this.auditService.log({
            tenantId: data.tenantId,
            userId: data.userId,
            action: 'CREATE',
            entityType: 'NOTE',
            entityId: note.id,
            details: `Created note for ${data.leadId ? 'Lead' : 'Deal'}`,
        });
        const [noteWithCreator] = await this.attachCreatedBy([note]);
        return noteWithCreator;
    }
    async findByEntity(entityId, type, tenantId) {
        if (!entityId || !['lead', 'deal'].includes(type)) {
            throw new common_1.BadRequestException('Valid entityId and type are required');
        }
        await this.ensureEntityExists(entityId, type, tenantId);
        const notes = await this.prisma.note.findMany({
            where: {
                AND: [
                    type === 'lead' ? { leadId: entityId } : { dealId: entityId },
                    { tenantId },
                ],
            },
            orderBy: { createdAt: 'desc' },
        });
        return this.attachCreatedBy(notes);
    }
    async remove(id, tenantId, userId) {
        const note = await this.prisma.note.findFirst({
            where: { id, tenantId },
        });
        if (!note)
            throw new common_1.NotFoundException('Note not found');
        await this.prisma.note.delete({ where: { id } });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'DELETE',
            entityType: 'NOTE',
            entityId: id,
        });
        return { success: true };
    }
};
exports.NotesService = NotesService;
exports.NotesService = NotesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], NotesService);
//# sourceMappingURL=notes.service.js.map