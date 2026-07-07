import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Mirrors ProspectSearchFilters (ai.service.ts) exactly - every key is
 * required, values may be null. The frontend always sends the complete
 * filters object it received back from a prior search response, so there is
 * no partial/optional variant to support here.
 */
export class ProspectSearchFiltersDto {
  @IsOptional()
  @IsString()
  industry!: string | null;

  @IsOptional()
  @IsString()
  city!: string | null;

  @IsOptional()
  @IsString()
  state!: string | null;

  @IsOptional()
  @IsString()
  country!: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  employeeMin!: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  employeeMax!: number | null;

  @IsOptional()
  @IsString()
  revenueRange!: string | null;

  @IsArray()
  @IsString({ each: true })
  keywords!: string[];
}
