import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
export declare class BranchesController {
    private readonly branchesService;
    constructor(branchesService: BranchesService);
    create(user: ActiveUser, dto: CreateBranchDto): Promise<{
        manager: {
            id: string;
            name: string | null;
            email: string;
            branchId: string | null;
            isSuperAdmin: boolean;
        } | null;
    } & {
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        location: string;
        managerId: string | null;
    }>;
    findAll(user: ActiveUser): Promise<({
        manager: {
            id: string;
            name: string | null;
            email: string;
            branchId: string | null;
            isSuperAdmin: boolean;
        } | null;
    } & {
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        location: string;
        managerId: string | null;
    })[]>;
    findOne(user: ActiveUser, id: string): Promise<{
        _count: {
            users: number;
            sites: number;
            guards: number;
            shifts: number;
            clients: number;
            incidents: number;
            invoices: number;
            reports: number;
        };
        manager: {
            id: string;
            name: string | null;
            email: string;
            branchId: string | null;
            isSuperAdmin: boolean;
        } | null;
    } & {
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        location: string;
        managerId: string | null;
    }>;
    update(user: ActiveUser, id: string, dto: UpdateBranchDto): Promise<{
        manager: {
            id: string;
            name: string | null;
            email: string;
            branchId: string | null;
            isSuperAdmin: boolean;
        } | null;
    } & {
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        location: string;
        managerId: string | null;
    }>;
}
