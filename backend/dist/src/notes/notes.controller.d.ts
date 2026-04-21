import { NotesService } from './notes.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
export declare class NotesController {
    private readonly notesService;
    constructor(notesService: NotesService);
    create(body: any, user: ActiveUser): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        leadId: string | null;
        content: string;
        dealId: string | null;
    }>;
    findByEntity(entityId: string, type: 'lead' | 'deal', user: ActiveUser): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        leadId: string | null;
        content: string;
        dealId: string | null;
    }[]>;
    remove(id: string, user: ActiveUser): Promise<{
        success: boolean;
    }>;
}
