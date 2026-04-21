import { SitesService } from './sites.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
export declare class SitesController {
    private readonly sitesService;
    constructor(sitesService: SitesService);
    create(user: ActiveUser, createSiteDto: CreateSiteDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        address: string;
        instructions: string | null;
    }>;
    findAll(user: ActiveUser): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        address: string;
        instructions: string | null;
    }[]>;
    update(user: ActiveUser, id: string, updateSiteDto: UpdateSiteDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        address: string;
        instructions: string | null;
    }>;
}
