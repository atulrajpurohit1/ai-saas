import { DocumentsService } from './documents.service';
import { Request } from 'express';
import { CreateDocumentDto } from './dto/create-document.dto';
export declare class DocumentsController {
    private readonly documentsService;
    constructor(documentsService: DocumentsService);
    create(req: Request, data: CreateDocumentDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        clientId: string;
        description: string | null;
        url: string;
        uploadedBy: string;
    }>;
    findAll(req: Request, clientId?: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        clientId: string;
        description: string | null;
        url: string;
        uploadedBy: string;
    }[]>;
    findOne(req: Request, id: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        clientId: string;
        description: string | null;
        url: string;
        uploadedBy: string;
    }>;
    remove(req: Request, id: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        clientId: string;
        description: string | null;
        url: string;
        uploadedBy: string;
    }>;
}
