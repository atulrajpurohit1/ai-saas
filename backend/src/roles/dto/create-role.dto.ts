import { ArrayNotEmpty, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permission_keys: string[];
}
