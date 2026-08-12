import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ProspectCompanyDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  employeeCount?: number;

  @IsOptional()
  @IsString()
  revenueRange?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // The fields below carry the discovered contact/prospect from BlackPearl
  // Prospecting (POST /v1/prospects) through to Lead import - the DTO fields
  // above predate that feature and only ever describe a company profile, not
  // a person. All optional: real responses frequently omit some of them.
  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactTitle?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactProfileUrl?: string;

  @IsOptional()
  @IsString()
  qualificationReason?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  signals?: string[];
}
