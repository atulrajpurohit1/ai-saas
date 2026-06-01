import { GuardsService } from './guards.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateGuardDto } from './dto/create-guard.dto';
import { UpdateGuardDto } from './dto/update-guard.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
export declare class GuardsController {
    private readonly guardsService;
    constructor(guardsService: GuardsService);
    create(user: ActiveUser, createGuardDto: CreateGuardDto): Promise<Omit<{
        id: string;
        name: string;
        createdAt: Date;
        email: string | null;
        tenantId: string;
        phone: string | null;
        passwordHash: string | null;
    }, "passwordHash">>;
    findAll(user: ActiveUser): Promise<Omit<{
        availability: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            status: string;
            guardId: string;
            startDate: Date | null;
            endDate: Date | null;
        } | null;
    } & {
        id: string;
        name: string;
        createdAt: Date;
        email: string | null;
        tenantId: string;
        phone: string | null;
        passwordHash: string | null;
    }, "passwordHash">[]>;
    update(user: ActiveUser, id: string, updateGuardDto: UpdateGuardDto): Promise<Omit<{
        id: string;
        name: string;
        createdAt: Date;
        email: string | null;
        tenantId: string;
        phone: string | null;
        passwordHash: string | null;
    }, "passwordHash">>;
    getAvailability(user: ActiveUser, id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        guardId: string;
        startDate: Date | null;
        endDate: Date | null;
    } | {
        status: string;
    }>;
    updateAvailability(user: ActiveUser, id: string, dto: UpdateAvailabilityDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        guardId: string;
        startDate: Date | null;
        endDate: Date | null;
    }>;
}
