import { Transform } from 'class-transformer';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { ColumnMapping } from '../import/crm-import.types';

export class ImportLeadsDto {
  /**
   * Maps each lead field onto the uploaded column that feeds it. Arrives as
   * a JSON string because the request is multipart (it carries the file).
   */
  @Transform(({ value }): unknown => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      // Leave it as the raw string so @IsObject reports the bad payload.
      return value;
    }
  })
  @IsObject({
    message: 'mapping must be a JSON object of field -> column name',
  })
  mapping: ColumnMapping;

  /** Where the export came from, recorded on the audit entry. */
  @IsString()
  @IsOptional()
  source?: string;
}
