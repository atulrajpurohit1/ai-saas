import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCheckpointDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  site_id: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location_note?: string;

  @IsOptional()
  @IsString()
  qr_code_value?: string;
}
