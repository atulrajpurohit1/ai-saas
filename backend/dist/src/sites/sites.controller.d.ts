import { SitesService } from './sites.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
export declare class SitesController {
    private readonly sitesService;
    constructor(sitesService: SitesService);
    create(user: ActiveUser, createSiteDto: CreateSiteDto): Promise<{
        branch: {
            id: string;
            name: string;
            status: string;
            location: string;
        } | null;
        client: {
            id: string;
            name: string;
            companyName: string | null;
        } | null;
    } & {
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        branchId: string | null;
        clientId: string | null;
        address: string;
        instructions: string | null;
    }>;
    findAll(user: ActiveUser, branchId?: string): Promise<({
        branch: {
            id: string;
            name: string;
            status: string;
            location: string;
        } | null;
        client: {
            id: string;
            name: string;
            companyName: string | null;
        } | null;
    } & {
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        branchId: string | null;
        clientId: string | null;
        address: string;
        instructions: string | null;
    })[]>;
    update(user: ActiveUser, id: string, updateSiteDto: UpdateSiteDto): Promise<{
        branch: {
            id: string;
            name: string;
            status: string;
            location: string;
        } | null;
        client: {
            id: string;
            name: string;
            companyName: string | null;
        } | null;
    } & {
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        branchId: string | null;
        clientId: string | null;
        address: string;
        instructions: string | null;
    }>;
}
