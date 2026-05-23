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
exports.ClientAuthService = exports.ClientRegisterDto = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const bcrypt = __importStar(require("bcrypt"));
const class_validator_1 = require("class-validator");
class ClientRegisterDto {
    email;
    password;
    name;
    tenantSlug;
}
exports.ClientRegisterDto = ClientRegisterDto;
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], ClientRegisterDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(6),
    __metadata("design:type", String)
], ClientRegisterDto.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ClientRegisterDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ClientRegisterDto.prototype, "tenantSlug", void 0);
let ClientAuthService = class ClientAuthService {
    prisma;
    jwtService;
    configService;
    constructor(prisma, jwtService, configService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async login(dto) {
        const user = await this.prisma.clientUser.findUnique({
            where: { email: dto.email },
            include: { client: true },
        });
        if (!user)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const passwordMatches = await bcrypt.compare(dto.password, user.password);
        if (!passwordMatches)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const tokens = await this.getTokens(user.id, user.email, user.tenantId, user.clientId);
        await this.updateRefreshTokenHash(user.id, tokens.refresh_token);
        return tokens;
    }
    async register(dto) {
        try {
            const tenant = await this.prisma.tenant.findUnique({
                where: { slug: dto.tenantSlug },
            });
            if (!tenant) {
                throw new common_1.ForbiddenException('Company not found. Please check the slug.');
            }
            const hashedPassword = await bcrypt.hash(dto.password, 10);
            const result = await this.prisma.$transaction(async (tx) => {
                const client = await tx.client.create({
                    data: {
                        name: dto.name,
                        email: dto.email,
                        tenantId: tenant.id,
                    },
                });
                const user = await tx.clientUser.create({
                    data: {
                        email: dto.email,
                        password: hashedPassword,
                        clientId: client.id,
                        tenantId: tenant.id,
                    },
                });
                const tokens = await this.getTokens(user.id, user.email, user.tenantId, user.clientId);
                return { user, tokens };
            });
            await this.updateRefreshTokenHash(result.user.id, result.tokens.refresh_token);
            return result.tokens;
        }
        catch (error) {
            if (typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                error.code === 'P2002') {
                throw new common_1.ConflictException('A client or client portal account already exists for this email.');
            }
            throw error;
        }
    }
    async logout(userId) {
        await this.prisma.clientUser.updateMany({
            where: { id: userId, refreshToken: { not: null } },
            data: { refreshToken: null },
        });
        return true;
    }
    async refreshTokens(userId, rt) {
        const user = await this.prisma.clientUser.findUnique({ where: { id: userId } });
        if (!user || !user.refreshToken)
            throw new common_1.ForbiddenException('Access Denied');
        const rtMatches = await bcrypt.compare(rt, user.refreshToken);
        if (!rtMatches)
            throw new common_1.ForbiddenException('Access Denied');
        const tokens = await this.getTokens(user.id, user.email, user.tenantId, user.clientId);
        await this.updateRefreshTokenHash(user.id, tokens.refresh_token);
        return tokens;
    }
    async updateRefreshTokenHash(userId, rt) {
        const hash = await bcrypt.hash(rt, 10);
        await this.prisma.clientUser.update({
            where: { id: userId },
            data: { refreshToken: hash },
        });
    }
    async getTokens(userId, email, tenantId, clientId) {
        const payload = { sub: userId, email, tenantId, clientId, role: 'client' };
        const [at, rt] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.get('JWT_ACCESS_SECRET'),
                expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN'),
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get('JWT_REFRESH_SECRET'),
                expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN'),
            }),
        ]);
        return {
            access_token: at,
            refresh_token: rt,
        };
    }
};
exports.ClientAuthService = ClientAuthService;
exports.ClientAuthService = ClientAuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], ClientAuthService);
//# sourceMappingURL=client-auth.service.js.map