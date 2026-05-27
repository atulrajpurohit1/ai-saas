import { Type } from 'class-transformer';
import { IsBoolean, IsISO8601, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class GenerateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  client_id: string;

  @IsOptional()
  @IsString()
  site_id?: string;

  @IsISO8601()
  billing_start_date: string;

  @IsISO8601()
  billing_end_date: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  hourly_rate?: number;

  @IsOptional()
  @IsBoolean()
  allow_manual_rate?: boolean;
}
