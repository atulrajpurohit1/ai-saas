import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Request shape for real, multi-company prospect discovery
 * (POST /prospect-search/discover -> BlackPearl's POST /v1/prospects).
 *
 * `objective` is the only required field - a natural-language description of
 * who to find (e.g. "Marketing agencies in India"). Everything else refines
 * the search using fields BlackPearl's Prospecting target actually supports;
 * there is no "revenue" or "technology" filter because BlackPearl's schema
 * has no such fields - adding them here would imply a capability that
 * doesn't exist.
 */
export class DiscoverProspectsDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  objective!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  locations?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  industries?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  jobTitles?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  keywords?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyHeadcountMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyHeadcountMax?: number;

  /**
   * Capped well below BlackPearl's own max of 100: each discovered prospect
   * is a metered, billed lookup (confirmed empirically: ~$0.11/prospect on
   * our account), so an ad-hoc search UI should default small and never let
   * a single request silently rack up a large bill.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
