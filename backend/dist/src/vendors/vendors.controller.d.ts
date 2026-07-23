import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { VendorsService } from './vendors.service';
export declare class VendorsController {
    private readonly vendorsService;
    constructor(vendorsService: VendorsService);
    create(user: ActiveUser, dto: CreateVendorDto): Promise<{
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
    findAll(user: ActiveUser, search?: string): Promise<{
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
    findOne(user: ActiveUser, id: string): Promise<{
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
    update(user: ActiveUser, id: string, dto: UpdateVendorDto): Promise<{
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
    remove(user: ActiveUser, id: string): Promise<{
        success: boolean;
    }>;
}
