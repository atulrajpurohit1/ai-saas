import { IsArray, IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateApiKeyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @IsOptional()
  @IsISO8601()
  expires_at?: string;

  @IsOptional()
  @IsIn(['active', 'revoked'])
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  rate_limit_per_minute?: number;
}
