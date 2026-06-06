import { IsOptional, IsString } from 'class-validator';

export class AssignUserRoleDto {
  @IsString()
  user_id: string;

  @IsString()
  role_id: string;

  @IsString()
  @IsOptional()
  branch_id?: string | null;
}
