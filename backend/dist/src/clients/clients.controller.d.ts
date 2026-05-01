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
        phone: string | null;
        companyName: string | null;
    }>;
    findAll(user: ActiveUser): Promise<({
        users: {
            email: string;
        }[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        tenantId: string;
        phone: string | null;
        companyName: string | null;
    })[]>;
    findOne(user: ActiveUser, id: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        tenantId: string;
        phone: string | null;
        companyName: string | null;
    }>;
    update(user: ActiveUser, id: string, dto: UpdateClientDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        tenantId: string;
        phone: string | null;
        companyName: string | null;
    }>;
    createUser(user: ActiveUser, id: string, email: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        password: string;
        refreshToken: string | null;
        tenantId: string;
        clientId: string;
    }>;
}
