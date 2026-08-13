import { ArrayMaxSize, IsArray, IsEmail, IsOptional, IsString } from 'class-validator';

export class SyncContactDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  contactEmail: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactTitle?: string;

  @IsOptional()
  @IsString()
  contactProfileUrl?: string;

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
  @IsString()
  qualificationReason?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  signals?: string[];
}
