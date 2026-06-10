import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdateCheckpointDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location_note?: string;

  @IsOptional()
  @IsString()
  qr_code_value?: string;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive'])
  status?: string;
}
