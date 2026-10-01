/**
 * Field-mapped CSV import - the vendor-neutral path for getting leads out of
 * *any* CRM. Every CRM can export a CSV, but none of them agree on column
 * names, so the client previews the file, maps its columns onto our lead
 * fields, and posts the mapping back with the commit request.
 */

/** Lead fields an uploaded column can be mapped onto. */
export const IMPORTABLE_FIELDS = [
  'name',
  'company',
  'email',
  'status',
] as const;

export type ImportableField = (typeof IMPORTABLE_FIELDS)[number];

/** Fields a file must supply before we will accept a mapping. */
export const REQUIRED_FIELDS: ImportableField[] = ['name', 'company'];

/** Maps a lead field onto the header of the uploaded column that feeds it. */
export type ColumnMapping = Partial<Record<ImportableField, string>>;

export interface ImportPreview {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  /** Best-guess mapping, so a well-formed export needs no manual work. */
  suggestedMapping: ColumnMapping;
  detectedCrm: string | null;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  totalRows: number;
  errors: { row: number; reason: string }[];
}
