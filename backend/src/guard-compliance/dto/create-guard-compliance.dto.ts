import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { GUARD_COMPLIANCE_TYPES } from '../compliance-types.constants';

export class CreateGuardComplianceDto {
  @IsNotEmpty()
  @IsString()
  guard_id: string;

  @IsIn(GUARD_COMPLIANCE_TYPES)
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  document_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  issuing_authority?: string;

  @IsOptional()
  @IsISO8601()
  issue_date?: string;

  @IsOptional()
  @IsISO8601()
  expiration_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
