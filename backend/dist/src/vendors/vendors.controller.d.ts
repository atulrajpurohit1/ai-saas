import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { VendorsService } from './vendors.service';
export declare class VendorsController {
    private readonly vendorsService;
    constructor(vendorsService: VendorsService);
    create(user: ActiveUser, dto: CreateVendorDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        notes: string | null;
        email: string | null;
        tenantId: string;
        companyName: string;
        phone: string | null;
        status: import(".prisma/client").$Enums.VendorStatus;
        createdBy: string | null;
        address: string | null;
        contactPerson: string | null;
        services: import("@prisma/client/runtime/library").JsonValue;
    }>;
    findAll(user: ActiveUser, search?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        notes: string | null;
        email: string | null;
        tenantId: string;
        companyName: string;
        phone: string | null;
        status: import(".prisma/client").$Enums.VendorStatus;
        createdBy: string | null;
        address: string | null;
        contactPerson: string | null;
        services: import("@prisma/client/runtime/library").JsonValue;
    }[]>;
    findOne(user: ActiveUser, id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        notes: string | null;
        email: string | null;
        tenantId: string;
        companyName: string;
        phone: string | null;
        status: import(".prisma/client").$Enums.VendorStatus;
        createdBy: string | null;
        address: string | null;
        contactPerson: string | null;
        services: import("@prisma/client/runtime/library").JsonValue;
    }>;
    update(user: ActiveUser, id: string, dto: UpdateVendorDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        notes: string | null;
        email: string | null;
        tenantId: string;
        companyName: string;
        phone: string | null;
        status: import(".prisma/client").$Enums.VendorStatus;
        createdBy: string | null;
        address: string | null;
        contactPerson: string | null;
        services: import("@prisma/client/runtime/library").JsonValue;
    }>;
    remove(user: ActiveUser, id: string): Promise<{
        success: boolean;
    }>;
}
