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
const branch_scope_1 = require("../branches/branch-scope");
const bcrypt = __importStar(require("bcrypt"));
const crypto_1 = require("crypto");
let ClientsService = class ClientsService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async create(user, dto) {
        const branchId = (0, branch_scope_1.resolveWriteBranchId)(user, dto.branch_id);
        const client = await this.prisma.client.create({
            data: {
                name: dto.name,
                companyName: dto.companyName,
                email: dto.email,
                phone: dto.phone,
                tenantId: user.tenantId,
                branchId,
            },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'CLIENT_CREATED',
            entityType: 'Client',
            entityId: client.id,
            details: `Client "${client.name}" created`,
        });
        return client;
    }
    async findAll(user, requestedBranchId) {
        return this.prisma.client.findMany({
            where: (0, branch_scope_1.branchScopedWhere)(user, requestedBranchId),
            select: {
                id: true,
                name: true,
                companyName: true,
                email: true,
                phone: true,
                createdAt: true,
                updatedAt: true,
                branchId: true,
                branch: {
                    select: {
                        id: true,
                        name: true,
                        location: true,
                        status: true,
                    },
                },
                users: {
                    select: {
                        id: true,
                        email: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOne(user, id) {
        const client = await this.prisma.client.findFirst({
            where: { id, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) },
            include: {
                branch: {
                    select: {
                        id: true,
                        name: true,
                        location: true,
                        status: true,
                    },
                },
                users: {
                    select: {
                        id: true,
                        email: true,
                        createdAt: true,
                    },
                },
            },
        });
        if (!client) {
            throw new common_1.NotFoundException('Client not found');
        }
        return client;
    }
    async update(user, id, dto) {
        const client = await this.prisma.client.findFirst({
            where: { id, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) },
        });
        if (!client) {
            throw new common_1.NotFoundException('Client not found');
        }
        const branchId = dto.branch_id === undefined
            ? undefined
            : (0, branch_scope_1.resolveWriteBranchId)(user, dto.branch_id);
        const updatedClient = await this.prisma.client.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name } : {}),
                ...(dto.companyName !== undefined ? { companyName: dto.companyName } : {}),
                ...(dto.email !== undefined ? { email: dto.email } : {}),
                ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
                ...(branchId !== undefined ? { branchId } : {}),
            },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'CLIENT_UPDATED',
            entityType: 'Client',
            entityId: client.id,
            details: `Client "${client.name}" updated`,
        });
        return updatedClient;
    }
    async createClientUser(user, clientId, email) {
        const client = await this.prisma.client.findFirst({
            where: { id: clientId, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) },
            include: {
                users: true,
            },
        });
        if (!client) {
            throw new common_1.NotFoundException('Client not found in this tenant');
        }
        if (client.users.length > 0) {
            throw new common_1.ConflictException('Client portal user already exists for this client');
        }
        const temporaryPassword = (0, crypto_1.randomBytes)(12).toString('base64url');
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
        try {
            const clientUser = await this.prisma.clientUser.create({
                data: {
                    email,
                    password: hashedPassword,
                    clientId,
                    tenantId: user.tenantId,
                },
            });
            return {
                id: clientUser.id,
                email: clientUser.email,
                clientId: clientUser.clientId,
                temporaryPassword,
            };
        }
        catch (error) {
            if (typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                error.code === 'P2002') {
                throw new common_1.ConflictException('A client portal user with this email already exists.');
            }
            throw error;
        }
    }
};
exports.ClientsService = ClientsService;
exports.ClientsService = ClientsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], ClientsService);
//# sourceMappingURL=clients.service.js.map