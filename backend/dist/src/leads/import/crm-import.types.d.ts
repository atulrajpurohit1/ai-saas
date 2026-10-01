export declare const IMPORTABLE_FIELDS: readonly ["name", "company", "email", "status"];
export type ImportableField = (typeof IMPORTABLE_FIELDS)[number];
export declare const REQUIRED_FIELDS: ImportableField[];
export type ColumnMapping = Partial<Record<ImportableField, string>>;
export interface ImportPreview {
    headers: string[];
    rows: Record<string, string>[];
    totalRows: number;
    suggestedMapping: ColumnMapping;
    detectedCrm: string | null;
}
export interface ImportResult {
    created: number;
    updated: number;
    skipped: number;
    totalRows: number;
    errors: {
        row: number;
        reason: string;
    }[];
}
