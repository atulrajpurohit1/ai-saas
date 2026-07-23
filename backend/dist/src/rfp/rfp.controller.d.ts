import { Response } from 'express';
import { RfpService } from './rfp.service';
import { CreateRfpDto } from './dto/create-rfp.dto';
import { UpdateRfpDto } from './dto/update-rfp.dto';
import { AssignVendorsDto } from './dto/assign-vendors.dto';
import { GenerateRfpDto } from '../ai/dto/generate-rfp.dto';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
export declare class RfpController {
    private readonly rfpService;
    constructor(rfpService: RfpService);
    generate(dto: GenerateRfpDto): Promise<{
        content: string;
    }>;
    create(user: ActiveUser, dto: CreateRfpDto): Promise<{
        id: string;
        tenantId: string;
        title: string;
        clientName: string;
        companyName: string | null;
        industry: string | null;
        projectName: string | null;
        dueDate: Date | null;
        startDate: Date | null;
        endDate: Date | null;
        estimatedBudget: number | null;
        securityTypes: import("@prisma/client/runtime/library").JsonValue;
        numberOfLocations: number | null;
        address: string | null;
        operatingHours: string | null;
        guardsRequired: number | null;
        additionalRequirements: string | null;
        generatedContent: string | null;
        status: import(".prisma/client").$Enums.RfpStatus;
        createdBy: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(user: ActiveUser): Promise<({
        id: string;
        tenantId: string;
        title: string;
        clientName: string;
        companyName: string | null;
        industry: string | null;
        projectName: string | null;
        dueDate: Date | null;
        startDate: Date | null;
        endDate: Date | null;
        estimatedBudget: number | null;
        securityTypes: import("@prisma/client/runtime/library").JsonValue;
        numberOfLocations: number | null;
        address: string | null;
        operatingHours: string | null;
        guardsRequired: number | null;
        additionalRequirements: string | null;
        generatedContent: string | null;
        status: import(".prisma/client").$Enums.RfpStatus;
        createdBy: string | null;
        createdAt: Date;
        updatedAt: Date;
    } & {
        createdByUser: {
            id: string;
            name: string | null;
            email: string;
        } | null;
    })[]>;
    findOne(user: ActiveUser, id: string): Promise<{
        id: string;
        tenantId: string;
        title: string;
        clientName: string;
        companyName: string | null;
        industry: string | null;
        projectName: string | null;
        dueDate: Date | null;
        startDate: Date | null;
        endDate: Date | null;
        estimatedBudget: number | null;
        securityTypes: import("@prisma/client/runtime/library").JsonValue;
        numberOfLocations: number | null;
        address: string | null;
        operatingHours: string | null;
        guardsRequired: number | null;
        additionalRequirements: string | null;
        generatedContent: string | null;
        status: import(".prisma/client").$Enums.RfpStatus;
        createdBy: string | null;
        createdAt: Date;
        updatedAt: Date;
    } & {
        createdByUser: {
            id: string;
            name: string | null;
            email: string;
        } | null;
    }>;
    update(user: ActiveUser, id: string, dto: UpdateRfpDto): Promise<{
        id: string;
        tenantId: string;
        title: string;
        clientName: string;
        companyName: string | null;
        industry: string | null;
        projectName: string | null;
        dueDate: Date | null;
        startDate: Date | null;
        endDate: Date | null;
        estimatedBudget: number | null;
        securityTypes: import("@prisma/client/runtime/library").JsonValue;
        numberOfLocations: number | null;
        address: string | null;
        operatingHours: string | null;
        guardsRequired: number | null;
        additionalRequirements: string | null;
        generatedContent: string | null;
        status: import(".prisma/client").$Enums.RfpStatus;
        createdBy: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(user: ActiveUser, id: string): Promise<{
        success: boolean;
    }>;
    exportPdf(user: ActiveUser, id: string, res: Response): Promise<void>;
    findAssignedVendors(user: ActiveUser, id: string): Promise<{
        id: string;
        tenantId: string;
        companyName: string;
        address: string | null;
        status: import(".prisma/client").$Enums.VendorStatus;
        createdBy: string | null;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        contactPerson: string | null;
        phone: string | null;
        services: import("@prisma/client/runtime/library").JsonValue;
        notes: string | null;
    }[]>;
    assignVendors(user: ActiveUser, id: string, dto: AssignVendorsDto): Promise<{
        id: string;
        tenantId: string;
        companyName: string;
        address: string | null;
        status: import(".prisma/client").$Enums.VendorStatus;
        createdBy: string | null;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        contactPerson: string | null;
        phone: string | null;
        services: import("@prisma/client/runtime/library").JsonValue;
        notes: string | null;
    }[]>;
    removeVendor(user: ActiveUser, id: string, vendorId: string): Promise<{
        success: boolean;
    }>;
}
