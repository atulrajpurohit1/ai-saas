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
exports.ActivitiesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
let ActivitiesService = class ActivitiesService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async create(data) {
        const activity = await this.prisma.activity.create({
            data: {
                type: data.type,
                subject: data.subject,
                description: data.description,
                dueDate: data.dueDate,
                dealId: data.dealId,
                tenantId: data.tenantId,
            },
        });
        await this.auditService.log({
            tenantId: data.tenantId,
            userId: data.userId,
            action: 'CREATE',
            entityType: 'ACTIVITY',
            entityId: activity.id,
            details: `Scheduled ${data.type}: ${data.subject}`,
        });
        return activity;
    }
    async findAll(tenantId, dealId) {
        return this.prisma.activity.findMany({
            where: {
                tenantId,
                ...(dealId ? { dealId } : {}),
            },
            orderBy: { dueDate: 'asc' },
        });
    }
    async updateStatus(id, status, tenantId, userId) {
        const activity = await this.prisma.activity.findFirst({
            where: { id, tenantId },
        });
        if (!activity)
            throw new common_1.NotFoundException('Activity not found');
        const updated = await this.prisma.activity.update({
            where: { id },
            data: { status },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'UPDATE_STATUS',
            entityType: 'ACTIVITY',
            entityId: id,
            details: `Updated activity status to ${status}`,
        });
        return updated;
    }
};
exports.ActivitiesService = ActivitiesService;
exports.ActivitiesService = ActivitiesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], ActivitiesService);
//# sourceMappingURL=activities.service.js.map