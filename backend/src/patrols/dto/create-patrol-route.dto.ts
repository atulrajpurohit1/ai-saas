import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePatrolRouteDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  site_id: string;

  @IsOptional()
  @IsString()
  description?: string;
}
