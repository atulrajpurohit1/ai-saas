import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { GuardLoginDto } from './dto/guard-login.dto';
export declare class GuardAuthService {
    private prisma;
    private jwtService;
    private configService;
    private auditService;
    constructor(prisma: PrismaService, jwtService: JwtService, configService: ConfigService, auditService: AuditService);
    login(dto: GuardLoginDto): Promise<{
        access_token: string;
        guard: {
            id: string;
            name: string;
            phone: string | null;
            email: string | null;
            tenantId: string;
            tenantName: string;
        };
    }>;
}
