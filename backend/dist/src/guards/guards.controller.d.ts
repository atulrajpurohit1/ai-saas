import { GuardsService } from './guards.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateGuardDto } from './dto/create-guard.dto';
import { UpdateGuardDto } from './dto/update-guard.dto';
export declare class GuardsController {
    private readonly guardsService;
    constructor(guardsService: GuardsService);
    create(user: ActiveUser, createGuardDto: CreateGuardDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        phone: string | null;
    }>;
    findAll(user: ActiveUser): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        phone: string | null;
    }[]>;
    update(user: ActiveUser, id: string, updateGuardDto: UpdateGuardDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        phone: string | null;
    }>;
}
