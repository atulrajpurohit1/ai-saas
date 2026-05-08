"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const bcrypt = __importStar(require("bcrypt"));
let ClientsService = class ClientsService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async create(userId, tenantId, dto) {
        const client = await this.prisma.client.create({
            data: {
                ...dto,
                tenantId,
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'CLIENT_CREATED',
            entityType: 'Client',
            entityId: client.id,
            details: `Client "${client.name}" created`,
        });
        return client;
    }
    async findAll(tenantId) {
        return this.prisma.client.findMany({
            where: { tenantId },
            include: { users: { select: { email: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOne(tenantId, id) {
        const client = await this.prisma.client.findFirst({
            where: { id, tenantId },
        });
        if (!client) {
            throw new common_1.NotFoundException('Client not found');
        }
        return client;
    }
    async update(userId, tenantId, id, dto) {
        const client = await this.prisma.client.findFirst({
            where: { id, tenantId },
        });
        if (!client) {
            throw new common_1.NotFoundException('Client not found');
        }
        const updatedClient = await this.prisma.client.update({
            where: { id },
            data: dto,
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'CLIENT_UPDATED',
            entityType: 'Client',
            entityId: client.id,
            details: `Client "${client.name}" updated`,
        });
        return updatedClient;
    }
    async createClientUser(tenantId, clientId, email) {
        const client = await this.prisma.client.findFirst({
            where: { id: clientId, tenantId },
        });
        if (!client) {
            throw new common_1.NotFoundException('Client not found in this tenant');
        }
        const password = 'client123';
        const hashedPassword = await bcrypt.hash(password, 10);
        return this.prisma.clientUser.create({
            data: {
                email,
                password: hashedPassword,
                clientId,
                tenantId,
            },
        });
    }
};
exports.ClientsService = ClientsService;
exports.ClientsService = ClientsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], ClientsService);
//# sourceMappingURL=clients.service.js.map