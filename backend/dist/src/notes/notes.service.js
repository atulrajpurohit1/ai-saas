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
    async create(data) {
        const note = await this.prisma.note.create({
            data: {
                content: data.content,
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
        return note;
    }
    async findByEntity(entityId, type, tenantId) {
        return this.prisma.note.findMany({
            where: {
                AND: [
                    type === 'lead' ? { leadId: entityId } : { dealId: entityId },
                    { tenantId },
                ],
            },
            orderBy: { createdAt: 'desc' },
        });
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