import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { SSO_PROVIDER_TYPES } from '../sso.constants';

export class SSORoleMappingDto {
  @IsString()
  external_group: string;

  @IsString()
  role_id: string;

  @IsOptional()
  @IsString()
  branch_id?: string | null;
}

export class CreateSSOProviderDto {
  @IsIn(SSO_PROVIDER_TYPES)
  provider_type: string;

  @IsString()
  provider_name: string;

  @IsOptional()
  @IsString()
  client_id?: string;

  @IsOptional()
  @IsString()
  client_secret?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  issuer_url?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  metadata_url?: string;

  @IsOptional()
  @IsString()
  saml_metadata?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  email_domains?: string[];

  @IsOptional()
  @IsBoolean()
  auto_provision?: boolean;

  @IsOptional()
  @IsString()
  default_role_id?: string | null;

  @IsOptional()
  @IsString()
  default_branch_id?: string | null;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SSORoleMappingDto)
  role_mappings?: SSORoleMappingDto[];
}
