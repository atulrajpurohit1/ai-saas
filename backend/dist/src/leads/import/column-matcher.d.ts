import { ColumnMapping } from './crm-import.types';
export declare function normalizeHeader(header: string): string;
export declare function suggestMapping(headers: string[]): ColumnMapping;
export declare function detectCrm(headers: string[]): string | null;
export declare function findNameParts(headers: string[]): {
    first: string;
    last: string;
} | null;
