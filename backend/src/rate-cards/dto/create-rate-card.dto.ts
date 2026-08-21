import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const RATE_CARD_STATUSES = ['active', 'inactive'] as const;
export type RateCardStatus = (typeof RATE_CARD_STATUSES)[number];

// Generous ceiling for a per-hour guard billing rate (covers premium/executive
// protection rates) — just enough to catch clear data-entry errors like a
// stray extra digit (e.g. $75,421/hr), not to constrain legitimate pricing.
const MAX_PLAUSIBLE_RATE = 500;

export class CreateRateCardDto {
  @IsString()
  @IsNotEmpty()
  client_id: string;

  @IsOptional()
  @IsString()
  site_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  role_name?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(MAX_PLAUSIBLE_RATE)
  hourly_rate: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(MAX_PLAUSIBLE_RATE)
  overtime_rate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(MAX_PLAUSIBLE_RATE)
  holiday_rate?: number;

  @IsISO8601()
  effective_from: string;

  @IsOptional()
  @IsISO8601()
  effective_to?: string;

  @IsOptional()
  @IsIn(RATE_CARD_STATUSES)
  status?: RateCardStatus;
}
