import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
export declare class VendorsService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    private normalizeServices;
    private findVendorOrThrow;
    create(tenantId: string, userId: string | undefined, dto: CreateVendorDto): Promise<{
        id: string;
        companyName: string;
        contactPerson: string | null;
        email: string | null;
        phone: string | null;
        address: string | null;
        services: import("@prisma/client/runtime/library").JsonValue;
        notes: string | null;
        status: import(".prisma/client").$Enums.VendorStatus;
        createdBy: string | null;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
    }>;
    findAll(tenantId: string, search?: string): Promise<{
        id: string;
        companyName: string;
        contactPerson: string | null;
        email: string | null;
        phone: string | null;
        address: string | null;
        services: import("@prisma/client/runtime/library").JsonValue;
        notes: string | null;
        status: import(".prisma/client").$Enums.VendorStatus;
        createdBy: string | null;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
    }[]>;
    findOne(tenantId: string, id: string): Promise<{
        id: string;
        companyName: string;
        contactPerson: string | null;
        email: string | null;
        phone: string | null;
        address: string | null;
        services: import("@prisma/client/runtime/library").JsonValue;
        notes: string | null;
        status: import(".prisma/client").$Enums.VendorStatus;
        createdBy: string | null;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
    }>;
    update(tenantId: string, userId: string | undefined, id: string, dto: UpdateVendorDto): Promise<{
        id: string;
        companyName: string;
        contactPerson: string | null;
        email: string | null;
        phone: string | null;
        address: string | null;
        services: import("@prisma/client/runtime/library").JsonValue;
        notes: string | null;
        status: import(".prisma/client").$Enums.VendorStatus;
        createdBy: string | null;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
    }>;
    remove(tenantId: string, userId: string | undefined, id: string): Promise<{
        success: boolean;
    }>;
}
