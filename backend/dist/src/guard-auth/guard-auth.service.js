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
exports.GuardAuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
let GuardAuthService = class GuardAuthService {
    prisma;
    jwtService;
    configService;
    auditService;
    constructor(prisma, jwtService, configService, auditService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.configService = configService;
        this.auditService = auditService;
    }
    async login(dto) {
        const identifier = (dto.identifier || dto.email || dto.phone || '').trim();
        if (!identifier) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const candidates = await this.prisma.guard.findMany({
            where: {
                OR: [
                    { email: identifier.toLowerCase() },
                    { phone: identifier },
                ],
            },
            include: { tenant: true },
        });
        for (const guard of candidates) {
            if (!guard.passwordHash)
                continue;
            const passwordMatches = await bcrypt.compare(dto.password, guard.passwordHash);
            if (!passwordMatches)
                continue;
            const accessToken = await this.jwtService.signAsync({
                sub: guard.id,
                guard_id: guard.id,
                guardId: guard.id,
                tenant_id: guard.tenantId,
                tenantId: guard.tenantId,
                role: 'guard',
                email: guard.email,
                phone: guard.phone,
            }, {
                secret: this.configService.get('JWT_ACCESS_SECRET'),
                expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN'),
            });
            await this.auditService.log({
                tenantId: guard.tenantId,
                userId: guard.id,
                action: 'GUARD_LOGIN',
                entityType: 'Guard',
                entityId: guard.id,
                details: `Guard "${guard.name}" logged in`,
            });
            return {
                access_token: accessToken,
                guard: {
                    id: guard.id,
                    name: guard.name,
                    phone: guard.phone,
                    email: guard.email,
                    tenantId: guard.tenantId,
                    tenantName: guard.tenant.name,
                },
            };
        }
        throw new common_1.UnauthorizedException('Invalid credentials');
    }
};
exports.GuardAuthService = GuardAuthService;
exports.GuardAuthService = GuardAuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        audit_service_1.AuditService])
], GuardAuthService);
//# sourceMappingURL=guard-auth.service.js.map