import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ColumnMapping, ImportPreview, ImportResult } from './crm-import.types';
export declare class CrmImportService {
    private readonly prisma;
    private readonly auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    preview(buffer: Buffer): Promise<ImportPreview>;
    commit(buffer: Buffer, mapping: ColumnMapping, tenantId: string, userId: string, sourceLabel?: string): Promise<ImportResult>;
    private resolveName;
    private value;
    private assertMappingIsUsable;
    private parseCsv;
    private dedupeHeaders;
}
