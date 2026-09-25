import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  companyName?: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  branch_id?: string | null;

  @IsString()
  @IsOptional()
  billing_notes?: string;

  @IsString()
  @IsOptional()
  billingNotes?: string;

  @IsString()
  @IsOptional()
  internal_notes?: string;

  @IsString()
  @IsOptional()
  internalNotes?: string;

  // Daily service report delivery.
  @IsBoolean()
  @IsOptional()
  reportEmailEnabled?: boolean;

  // MANUAL: a supervisor publishes and the email goes then.
  // AUTOMATIC: sent without review once the shift ends.
  @IsIn(['MANUAL', 'AUTOMATIC'])
  @IsOptional()
  reportEmailMode?: 'MANUAL' | 'AUTOMATIC';

  @IsString()
  @IsOptional()
  reportEmailCc?: string;
}
