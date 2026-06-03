import { ClientsService } from './clients.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
export declare class ClientsController {
    private readonly clientsService;
    constructor(clientsService: ClientsService);
    create(user: ActiveUser, dto: CreateClientDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        tenantId: string;
        branchId: string | null;
        companyName: string | null;
        phone: string | null;
    }>;
    findAll(user: ActiveUser, branchId?: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        users: {
            id: string;
            createdAt: Date;
            email: string;
        }[];
        email: string;
        branchId: string | null;
        branch: {
            id: string;
            name: string;
            status: string;
            location: string;
        } | null;
        companyName: string | null;
        phone: string | null;
    }[]>;
    findOne(user: ActiveUser, id: string): Promise<{
        users: {
            id: string;
            createdAt: Date;
            email: string;
        }[];
        branch: {
            id: string;
            name: string;
            status: string;
            location: string;
        } | null;
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        tenantId: string;
        branchId: string | null;
        companyName: string | null;
        phone: string | null;
    }>;
    update(user: ActiveUser, id: string, dto: UpdateClientDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        tenantId: string;
        branchId: string | null;
        companyName: string | null;
        phone: string | null;
    }>;
    createUser(user: ActiveUser, id: string, email: string): Promise<{
        id: string;
        email: string;
        clientId: string;
        temporaryPassword: string;
    }>;
}
