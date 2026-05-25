import { NotesService } from './notes.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
export declare class NotesController {
    private readonly notesService;
    constructor(notesService: NotesService);
    create(body: any, user: ActiveUser): Promise<{
        createdBy: {
            id: string;
            name: string | null;
            email: string;
        } | null;
        id: string;
        content: string;
        leadId: string | null;
        dealId: string | null;
        tenantId: string;
        createdAt: Date;
    }>;
    findByEntity(entityId: string, type: 'lead' | 'deal', user: ActiveUser): Promise<{
        createdBy: {
            id: string;
            name: string | null;
            email: string;
        } | null;
        id: string;
        content: string;
        leadId: string | null;
        dealId: string | null;
        tenantId: string;
        createdAt: Date;
    }[]>;
    remove(id: string, user: ActiveUser): Promise<{
        success: boolean;
    }>;
}
