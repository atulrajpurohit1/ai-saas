import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { CLIENT_INSURANCE_TYPES } from '../client-insurance-types.constants';

export class CreateClientInsurancePolicyDto {
  @IsString()
  @IsNotEmpty()
  client_id: string;

  // Null / omitted => client-wide policy. Set => policy scoped to one of the
  // client's own sites (validated server-side).
  @IsOptional()
  @IsString()
  site_id?: string | null;

  @IsIn(CLIENT_INSURANCE_TYPES)
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  policy_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  insurer?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  coverage_amount?: number;

  @IsOptional()
  @IsISO8601()
  effective_date?: string;

  @IsOptional()
  @IsISO8601()
  expiration_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
