import { Type } from 'class-transformer';
import { IsISO8601, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export const RATE_CARD_STATUSES = ['active', 'inactive'] as const;
export type RateCardStatus = (typeof RATE_CARD_STATUSES)[number];

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
  hourly_rate: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  overtime_rate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
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
