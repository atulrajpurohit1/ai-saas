import {
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const VENDOR_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type VendorStatusValue = (typeof VENDOR_STATUSES)[number];

export class CreateVendorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  companyName: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactPerson?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  services?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(VENDOR_STATUSES)
  status?: VendorStatusValue;
}
