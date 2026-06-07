import { IsEmail, IsHexColor, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  company_name?: string | null;

  @IsOptional()
  @IsString()
  logo_url?: string | null;

  @IsOptional()
  @IsString()
  favicon_url?: string | null;

  @IsOptional()
  @IsHexColor()
  primary_color?: string;

  @IsOptional()
  @IsHexColor()
  secondary_color?: string;

  @IsOptional()
  @IsHexColor()
  accent_color?: string;

  @IsOptional()
  @IsString()
  login_background?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  welcome_message?: string | null;

  @IsOptional()
  @IsEmail()
  support_email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  support_phone?: string | null;
}
