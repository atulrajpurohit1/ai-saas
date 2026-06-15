import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}
