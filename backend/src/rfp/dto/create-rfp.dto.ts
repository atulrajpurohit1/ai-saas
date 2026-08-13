import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const RFP_STATUSES = ['DRAFT', 'GENERATED', 'FINALIZED'] as const;
export type RfpStatusValue = (typeof RFP_STATUSES)[number];

export const PRICING_MODELS = [
  'Hourly',
  'Monthly',
  'Annual',
  'Project Based',
] as const;
export type PricingModelValue = (typeof PRICING_MODELS)[number];

export class CreateRfpDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  clientName: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  projectName?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedBudget?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  securityTypes?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  numberOfLocations?: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  operatingHours?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  guardsRequired?: number;

  @IsOptional()
  @IsIn(PRICING_MODELS)
  pricingModel?: PricingModelValue;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredPricingItems?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pricingValidity?: string;

  @IsOptional()
  @IsString()
  pricingNotes?: string;

  @IsOptional()
  @IsString()
  additionalRequirements?: string;

  @IsOptional()
  @IsString()
  generatedContent?: string;

  @IsOptional()
  @IsString()
  issuerLogoUrl?: string;

  @IsOptional()
  @IsString()
  recipientLogoUrl?: string;

  @IsOptional()
  @IsIn(RFP_STATUSES)
  status?: RfpStatusValue;
}
