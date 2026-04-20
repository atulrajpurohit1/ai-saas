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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const bcrypt = __importStar(require("bcrypt"));
let AuthService = class AuthService {
    prisma;
    jwtService;
    configService;
    constructor(prisma, jwtService, configService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async register(dto) {
        const hashedPassword = await bcrypt.hash(dto.password, 10);
        try {
            const result = await this.prisma.$transaction(async (tx) => {
                const tenant = await tx.tenant.create({
                    data: {
                        name: dto.tenantName,
                        slug: dto.tenantSlug,
                    },
                });
                const user = await tx.user.create({
                    data: {
                        email: dto.email,
                        password: hashedPassword,
                        name: dto.name,
                        tenantId: tenant.id,
                    },
                });
                return { tenant, user };
            });
            const tokens = await this.getTokens(result.user.id, result.user.email, result.tenant.id, 'admin');
            await this.updateRefreshTokenHash(result.user.id, tokens.refresh_token, 'admin');
            return tokens;
        }
        catch (error) {
            if (typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                error.code === 'P2002') {
                const meta = error.meta;
                throw new common_1.ConflictException(`Unique constraint failed on the fields: ${meta?.target?.join(', ') || 'unknown'}`);
            }
            throw error;
        }
    }
    async login(dto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
            include: { tenant: true },
        });
        if (!user)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const passwordMatches = await bcrypt.compare(dto.password, user.password);
        if (!passwordMatches)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const tokens = await this.getTokens(user.id, user.email, user.tenantId, 'admin');
        await this.updateRefreshTokenHash(user.id, tokens.refresh_token, 'admin');
        return tokens;
    }
    async logout(userId) {
        await this.prisma.user.updateMany({
            where: { id: userId, refreshToken: { not: null } },
            data: { refreshToken: null },
        });
        return true;
    }
    async refreshTokens(userId, rt, role) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.refreshToken)
            throw new common_1.ForbiddenException('Access Denied');
        const rtMatches = await bcrypt.compare(rt, user.refreshToken);
        if (!rtMatches)
            throw new common_1.ForbiddenException('Access Denied');
        const typedUser = user;
        const tokens = await this.getTokens(typedUser.id, typedUser.email, typedUser.tenantId, 'admin');
        await this.updateRefreshTokenHash(typedUser.id, tokens.refresh_token, 'admin');
        return tokens;
    }
    async updateRefreshTokenHash(userId, rt, role) {
        const hash = await bcrypt.hash(rt, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: { refreshToken: hash },
        });
    }
    async getTokens(userId, email, tenantId, role) {
        const atSecret = this.configService.get('JWT_ACCESS_SECRET');
        const atExpires = this.configService.get('JWT_ACCESS_EXPIRES_IN');
        const rtSecret = this.configService.get('JWT_REFRESH_SECRET');
        const rtExpires = this.configService.get('JWT_REFRESH_EXPIRES_IN');
        const [at, rt] = await Promise.all([
            this.jwtService.signAsync({ sub: userId, email, tenantId, role }, {
                secret: atSecret,
                expiresIn: atExpires,
            }),
            this.jwtService.signAsync({ sub: userId, email, tenantId, role }, {
                secret: rtSecret,
                expiresIn: rtExpires,
            }),
        ]);
        return {
            access_token: at,
            refresh_token: rt,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map