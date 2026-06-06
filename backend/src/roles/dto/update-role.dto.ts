import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  @MaxLength(80)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  permission_keys?: string[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
